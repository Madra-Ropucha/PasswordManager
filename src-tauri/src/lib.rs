use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

use rusqlite::Connection;

mod crypto;
mod db;
use breach_check::BreachChecker;
struct BreachState(Mutex<BreachChecker>);

/// Estado global de la conexión SQLite abierta (del vault ya descifrado).
pub struct DbState(pub Mutex<Option<Connection>>);

/// Info del vault abierto (para poder re-cifrar el fichero al persistir).
pub struct VaultState(pub Mutex<Option<VaultSession>>);

struct VaultSession {
    name: String,
    vault_path: PathBuf, // fichero cifrado (.vault)
    plain_path: PathBuf, // sqlite en claro (solo mientras está abierto)
    key: [u8; 32],       // clave derivada (no guardamos la contraseña)
}

fn sanitize_vault_name(raw: &str) -> Result<String, String> {
    let s = raw.trim();
    if s.is_empty() {
        return Err("El nombre del vault es obligatorio".to_string());
    }

    // Permitimos letras, números, '-' '_' y espacios. Los espacios se convierten a '_'.
    let mut out = String::new();
    for ch in s.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
            out.push(ch);
        } else if ch.is_whitespace() {
            out.push('_');
        }
    }

    // Evitar nombres raros / traversal.
    out = out.trim_matches('_').to_string();
    if out.is_empty() {
        return Err("Nombre de vault inválido".to_string());
    }
    if out.starts_with('.') {
        return Err("Nombre de vault inválido".to_string());
    }

    Ok(out)
}

fn vaults_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    Ok(app_dir.join("vaults"))
}

fn open_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(vaults_dir(app)?.join(".open"))
}

fn tmp_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(vaults_dir(app)?.join(".tmp"))
}

fn vault_file_path(app: &tauri::AppHandle, vault_name: &str) -> Result<PathBuf, String> {
    Ok(vaults_dir(app)?.join(format!("{}.vault", vault_name)))
}

fn plain_db_path(app: &tauri::AppHandle, vault_name: &str) -> Result<PathBuf, String> {
    Ok(open_dir(app)?.join(format!("{}.db", vault_name)))
}

fn atomic_write(path: &Path, data: &[u8]) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, data).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())?;
    Ok(())
}

fn persist_current_vault(vault_state: &VaultState, db_state: &DbState) -> Result<(), String> {
    let session_guard = vault_state.0.lock().map_err(|_| "vault lock poisoned".to_string())?;
    let Some(session) = session_guard.as_ref() else {
        return Ok(());
    };

    let conn_guard = db_state.0.lock().map_err(|_| "db lock poisoned".to_string())?;
    let Some(conn) = conn_guard.as_ref() else {
        return Ok(());
    };

    // Aseguramos que no quede nada en WAL (por si acaso).
    let _ = conn.execute_batch(
        "PRAGMA wal_checkpoint(TRUNCATE);\nPRAGMA journal_mode=DELETE;\nPRAGMA synchronous=FULL;",
    );

    let plain = fs::read(&session.plain_path).map_err(|e| e.to_string())?;
    let encrypted = crypto::encrypt_bytes(&plain, &session.key)?;
    atomic_write(&session.vault_path, &encrypted)
}

fn close_vault_inner(vault_state: &VaultState, db_state: &DbState) -> Result<(), String> {
    // Persistimos primero.
    persist_current_vault(vault_state, db_state)?;

    // Cerramos conn.
    {
        let mut conn_guard = db_state.0.lock().map_err(|_| "db lock poisoned".to_string())?;
        *conn_guard = None;
    }

    // Borramos el fichero en claro y limpiamos sesión.
    let mut session_guard = vault_state.0.lock().map_err(|_| "vault lock poisoned".to_string())?;
    if let Some(session) = session_guard.take() {
        let _ = fs::remove_file(session.plain_path);
    }
    Ok(())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// --- Vault management ("usuarios" = vaults) ---

#[tauri::command]
fn cmd_list_vaults(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let dir = vaults_dir(&app)?;
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut out = vec![];
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if !entry.file_type().map_err(|e| e.to_string())?.is_file() {
            continue;
        }
        let path = entry.path();
        if path.extension().and_then(|x| x.to_str()) != Some("vault") {
            continue;
        }
        if let Some(stem) = path.file_stem().and_then(|x| x.to_str()) {
            if !stem.starts_with('.') {
                out.push(stem.to_string());
            }
        }
    }
    out.sort();
    Ok(out)
}

#[tauri::command]
fn cmd_create_vault(app: tauri::AppHandle, vault_name: String, password: String) -> Result<(), String> {
    let name = sanitize_vault_name(&vault_name)?;
    if password.is_empty() {
        return Err("La contraseña es obligatoria".to_string());
    }

    let vault_path = vault_file_path(&app, &name)?;
    if vault_path.exists() {
        return Err("Ya existe un vault con ese nombre".to_string());
    }

    let tmp = tmp_dir(&app)?;
    fs::create_dir_all(&tmp).map_err(|e| e.to_string())?;
    let tmp_db = tmp.join(format!("{}.db", name));
    if tmp_db.exists() {
        let _ = fs::remove_file(&tmp_db);
    }

    db::init_db(tmp_db.to_str().ok_or("invalid tmp path")?)?;

    let plain = fs::read(&tmp_db).map_err(|e| e.to_string())?;
    let key = crypto::key_from_password(&password);
    let encrypted = crypto::encrypt_bytes(&plain, &key)?;
    atomic_write(&vault_path, &encrypted)?;

    let _ = fs::remove_file(&tmp_db);
    Ok(())
}

#[tauri::command]
fn cmd_open_vault(
    app: tauri::AppHandle,
    vault_name: String,
    password: String,
    vault_state: tauri::State<VaultState>,
    db_state: tauri::State<DbState>,
) -> Result<(), String> {
    // Cerramos cualquier sesión anterior.
    close_vault_inner(&vault_state, &db_state).ok();

    let name = sanitize_vault_name(&vault_name)?;
    let vault_path = vault_file_path(&app, &name)?;
    if !vault_path.exists() {
        return Err("Ese vault no existe".to_string());
    }

    let open = open_dir(&app)?;
    fs::create_dir_all(&open).map_err(|e| e.to_string())?;
    let plain_path = plain_db_path(&app, &name)?;
    if plain_path.exists() {
        let _ = fs::remove_file(&plain_path);
    }

    let key = crypto::key_from_password(&password);
    let decrypted = crypto::decrypt_file(vault_path.to_str().ok_or("invalid vault path")?, &key)?;
    fs::write(&plain_path, &decrypted).map_err(|e| e.to_string())?;

    let conn = Connection::open(&plain_path).map_err(|e| e.to_string())?;
    // PRAGMAs de seguridad / consistencia.
    let _ = conn.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;");

    {
        let mut guard = db_state.0.lock().map_err(|_| "db lock poisoned".to_string())?;
        *guard = Some(conn);
    }
    {
        let mut guard = vault_state.0.lock().map_err(|_| "vault lock poisoned".to_string())?;
        *guard = Some(VaultSession {
            name,
            vault_path,
            plain_path,
            key,
        });
    }

    Ok(())
}

#[tauri::command]
fn cmd_close_vault(
    vault_state: tauri::State<VaultState>,
    db_state: tauri::State<DbState>,
) -> Result<(), String> {
    close_vault_inner(&vault_state, &db_state)
}

#[tauri::command]
fn cmd_current_vault(vault_state: tauri::State<VaultState>) -> Result<Option<String>, String> {
    let guard = vault_state.0.lock().map_err(|_| "vault lock poisoned".to_string())?;
    Ok(guard.as_ref().map(|s| s.name.clone()))
}

// --- Legacy crypto commands (útiles para tests) ---

#[tauri::command]
fn encrypt(path: &str, password: &str) -> Result<(), String> {
    let key = crypto::key_from_password(password);
    crypto::encrypt_file(path, &key)
}

#[tauri::command]
fn decrypt(path: &str, password: &str) -> Result<Vec<u8>, String> {
    let key = crypto::key_from_password(password);
    crypto::decrypt_file(path, &key)
}

#[tauri::command]
fn hash_password(password: &str) -> String {
    crypto::hash_password(password)
}

// --- KV (para que la UI guarde datos dentro del vault) ---

fn with_conn<T>(state: &DbState, f: impl FnOnce(&Connection) -> Result<T, String>) -> Result<T, String> {
    let guard = state.0.lock().map_err(|_| "db lock poisoned".to_string())?;
    let conn = guard.as_ref().ok_or("No hay ningún vault abierto".to_string())?;
    f(conn)
}

#[tauri::command]
fn cmd_kv_get(db_state: tauri::State<DbState>, key: String) -> Result<Option<String>, String> {
    with_conn(&db_state, |conn| db::kv_get(conn, &key))
}

#[tauri::command]
fn cmd_kv_set(
    db_state: tauri::State<DbState>,
    vault_state: tauri::State<VaultState>,
    key: String,
    value: String,
) -> Result<(), String> {
    with_conn(&db_state, |conn| db::kv_set(conn, &key, &value))?;
    // Persistimos para no perder cambios si la app crashea.
    persist_current_vault(&vault_state, &db_state)
}

// --- Folder/password DB commands ---

#[tauri::command]
fn cmd_get_root_folders(state: tauri::State<DbState>) -> Result<Vec<db::Folder>, String> {
    with_conn(&state, |conn| db::get_root_folders(conn))
}

#[tauri::command]
fn cmd_get_folders_by_parent(state: tauri::State<DbState>, father_id: i64) -> Result<Vec<db::Folder>, String> {
    with_conn(&state, |conn| db::get_folders_by_parent(conn, father_id))
}

#[tauri::command]
fn cmd_get_passwords_by_folder(state: tauri::State<DbState>, father_id: i64) -> Result<Vec<db::Password>, String> {
    with_conn(&state, |conn| db::get_passwords_by_folder(conn, father_id))
}

#[tauri::command]
fn cmd_get_folder_by_id(state: tauri::State<DbState>, id: i64) -> Result<db::Folder, String> {
    with_conn(&state, |conn| db::get_folder_by_id(conn, id))
}

#[tauri::command]
fn cmd_get_password_by_id(state: tauri::State<DbState>, id: i64) -> Result<db::Password, String> {
    with_conn(&state, |conn| db::get_password_by_id(conn, id))
}

#[tauri::command]
fn cmd_insert_folder(
    db_state: tauri::State<DbState>,
    vault_state: tauri::State<VaultState>,
    name: &str,
    father_id: Option<i64>,
) -> Result<(), String> {
    with_conn(&db_state, |conn| db::insert_folder(conn, name, father_id))?;
    persist_current_vault(&vault_state, &db_state)
}

#[tauri::command]
fn cmd_insert_password(
    db_state: tauri::State<DbState>,
    vault_state: tauri::State<VaultState>,
    name: &str,
    login: &str,
    password: &str,
    url: &str,
    father_id: Option<i64>,
) -> Result<(), String> {
    with_conn(&db_state, |conn| db::insert_password(conn, name, login, password, url, father_id))?;
    persist_current_vault(&vault_state, &db_state)
}

#[tauri::command]
fn cmd_update_folder(
    db_state: tauri::State<DbState>,
    vault_state: tauri::State<VaultState>,
    id: i64,
    name: &str,
    father_id: Option<i64>,
) -> Result<(), String> {
    with_conn(&db_state, |conn| db::update_folder(conn, id, name, father_id))?;
    persist_current_vault(&vault_state, &db_state)
}

#[tauri::command]
fn cmd_update_password(
    db_state: tauri::State<DbState>,
    vault_state: tauri::State<VaultState>,
    id: i64,
    name: &str,
    login: &str,
    password: &str,
    url: &str,
    father_id: Option<i64>,
) -> Result<(), String> {
    with_conn(&db_state, |conn| db::update_password(conn, id, name, login, password, url, father_id))?;
    persist_current_vault(&vault_state, &db_state)
}

#[tauri::command]
fn cmd_delete_folder(
    db_state: tauri::State<DbState>,
    vault_state: tauri::State<VaultState>,
    id: i64,
) -> Result<(), String> {
    with_conn(&db_state, |conn| db::delete_folder(conn, id))?;
    persist_current_vault(&vault_state, &db_state)
}

#[tauri::command]
fn cmd_delete_password(
    db_state: tauri::State<DbState>,
    vault_state: tauri::State<VaultState>,
    id: i64,
) -> Result<(), String> {
    with_conn(&db_state, |conn| db::delete_password(conn, id))?;
    persist_current_vault(&vault_state, &db_state)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .setup(|app| {
        use tauri::Manager;

        let app_dir = app.path().app_data_dir().expect("could not get app dir");
        .plugin(tauri_plugin_opener::init())
        .manage(DbState(Mutex::new(None)))
        .manage(VaultState(Mutex::new(None)))
        .setup(|app| {
            use tauri::Manager;
            let app_dir = app.path().app_data_dir().expect("could not get app dir");

        let vaults_dir = app_dir.join("vaults");

        if !vaults_dir.exists() {
            std::fs::create_dir(&vaults_dir).expect("could not create vaults directory");
        }

        Ok(())
    })
    .invoke_handler(tauri::generate_handler![
        greet,
        encrypt,
        decrypt,
        hash_password,
        cmd_get_root_folders,
        cmd_get_folders_by_parent,
        cmd_get_passwords_by_folder,
        cmd_get_folder_by_id,
        cmd_get_password_by_id,
        cmd_insert_folder,
        cmd_insert_password,
        cmd_update_folder,
        cmd_update_password,
        cmd_delete_folder,
        cmd_delete_password,
    ])
    .run(tauri::generate_context!())
}
mod generator;
use generator::{generate_password, PasswordOptions};

#[tauri::command]
fn cmd_generate_password(
    length: usize,
    uppercase: bool,
    lowercase: bool,
    numbers: bool,
    symbols: bool,
) -> Result<String, String> {

    let options = PasswordOptions {
        length,
        uppercase,
        lowercase,
        numbers,
        symbols,
    };

    generate_password(&options)
}
#[tauri::command]
fn cmd_check_password_breach(
    password: &str,
    state: tauri::State<BreachState>
) -> Result<Option<u32>, String> {

    let mut checker = state.0.lock().unwrap();

    checker
        .check_password(password)
        .map_err(|e| e.to_string())
            let vaults = app_dir.join("vaults");
            let open = vaults.join(".open");
            let tmp = vaults.join(".tmp");

            fs::create_dir_all(&vaults).expect("could not create vaults directory");
            fs::create_dir_all(&open).expect("could not create open directory");
            fs::create_dir_all(&tmp).expect("could not create tmp directory");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            // vault
            cmd_list_vaults,
            cmd_create_vault,
            cmd_open_vault,
            cmd_close_vault,
            cmd_current_vault,
            // crypto
            encrypt,
            decrypt,
            hash_password,
            // kv
            cmd_kv_get,
            cmd_kv_set,
            // db
            cmd_get_root_folders,
            cmd_get_folders_by_parent,
            cmd_get_passwords_by_folder,
            cmd_get_folder_by_id,
            cmd_get_password_by_id,
            cmd_insert_folder,
            cmd_insert_password,
            cmd_update_folder,
            cmd_update_password,
            cmd_delete_folder,
            cmd_delete_password,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
