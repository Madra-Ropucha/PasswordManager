use std::sync::Mutex;
use std::fs::File;

mod crypto;
mod db;
mod breach_check;
mod generator;

use breach_check::BreachChecker;
use generator::{generate_password, PasswordOptions};
use rusqlite::Connection;

struct BreachState(Mutex<BreachChecker>);

/// Estado global de la conexión SQLite abierta
pub struct DbState(pub Mutex<Connection>);

/// Estado opcional de un vault abierto (solo si quieres vaults cifrados en el futuro)
#[derive(Clone)]
pub struct VaultState(pub Mutex<Option<VaultSession>>);

struct VaultSession {
    name: String,
    vault_path: std::path::PathBuf,
    plain_path: std::path::PathBuf,
    key: [u8; 32],
}

// -------------------- Comandos --------------------

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

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

// ---------- Folder / Password DB Commands ----------

fn with_conn<T>(state: &DbState, f: impl FnOnce(&Connection) -> Result<T, String>) -> Result<T, String> {
    let conn = state.0.lock().map_err(|_| "db lock poisoned".to_string())?;
    f(&conn)
}

#[tauri::command]
fn cmd_get_root_folders(state: tauri::State<DbState>) -> Result<Vec<db::Folder>, String> {
    with_conn(&state, db::get_root_folders)
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
fn cmd_insert_folder(state: tauri::State<DbState>, name: &str, father_id: Option<i64>) -> Result<(), String> {
    with_conn(&state, |conn| db::insert_folder(conn, name, father_id))
}

#[tauri::command]
fn cmd_insert_password(
    state: tauri::State<DbState>,
    name: &str,
    login: &str,
    password: &str,
    url: &str,
    father_id: Option<i64>,
) -> Result<(), String> {
    with_conn(&state, |conn| db::insert_password(conn, name, login, password, url, father_id))
}

#[tauri::command]
fn cmd_update_folder(state: tauri::State<DbState>, id: i64, name: &str, father_id: Option<i64>) -> Result<(), String> {
    with_conn(&state, |conn| db::update_folder(conn, id, name, father_id))
}

#[tauri::command]
fn cmd_update_password(
    state: tauri::State<DbState>,
    id: i64,
    name: &str,
    login: &str,
    password: &str,
    url: &str,
    father_id: Option<i64>,
) -> Result<(), String> {
    with_conn(&state, |conn| db::update_password(conn, id, name, login, password, url, father_id))
}

#[tauri::command]
fn cmd_delete_folder(state: tauri::State<DbState>, id: i64) -> Result<(), String> {
    with_conn(&state, |conn| db::delete_folder(conn, id))
}

#[tauri::command]
fn cmd_delete_password(state: tauri::State<DbState>, id: i64) -> Result<(), String> {
    with_conn(&state, |conn| db::delete_password(conn, id))
}

// ---------- Password Generator / Breach Checker ----------

#[tauri::command]
fn cmd_generate_password(
    length: usize,
    uppercase: bool,
    lowercase: bool,
    numbers: bool,
    symbols: bool,
) -> Result<String, String> {
    let options = PasswordOptions { length, uppercase, lowercase, numbers, symbols };
    generate_password(&options)
}

#[tauri::command]
fn cmd_check_password_breach(password: &str, state: tauri::State<BreachState>) -> Result<Option<u32>, String> {
    let mut checker = state.0.lock().map_err(|_| "breach checker lock poisoned".to_string())?;
    checker.check_password(password).map_err(|e| e.to_string())
}

// -------------------- Run --------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(BreachState(Mutex::new(BreachChecker::new())))
        .manage(DbState(Mutex::new(Connection::open_in_memory().expect("could not open DB"))))
        .manage(VaultState(Mutex::new(None)))
        .setup(|app| {
            use tauri::Manager;
            let app_dir = app.path().app_data_dir().expect("could not get app dir");

            let vaults_dir = app_dir.join("vaults");
            let open_dir = vaults_dir.join(".open");
            let tmp_dir = vaults_dir.join(".tmp");

            std::fs::create_dir_all(&vaults_dir).expect("could not create vaults directory");
            std::fs::create_dir_all(&open_dir).expect("could not create .open directory");
            std::fs::create_dir_all(&tmp_dir).expect("could not create .tmp directory");

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
            cmd_generate_password,
            cmd_check_password_breach,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}