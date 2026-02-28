use std::sync::Mutex;
use std::fs::File;
mod crypto;
mod db;
use breach_check::BreachChecker;
struct BreachState(Mutex<BreachChecker>);
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

#[tauri::command]
fn cmd_get_root_folders(state: tauri::State<DbState>) -> Result<Vec<db::Folder>, String> {
    let conn = state.0.lock().unwrap();
    db::get_root_folders(&conn)
}

#[tauri::command]
fn cmd_get_folders_by_parent(state: tauri::State<DbState>, father_id: i64) -> Result<Vec<db::Folder>, String> {
    let conn = state.0.lock().unwrap();
    db::get_folders_by_parent(&conn, father_id)
}

#[tauri::command]
fn cmd_get_passwords_by_folder(state: tauri::State<DbState>, father_id: i64) -> Result<Vec<db::Password>, String> {
    let conn = state.0.lock().unwrap();
    db::get_passwords_by_folder(&conn, father_id)
}

#[tauri::command]
fn cmd_get_folder_by_id(state: tauri::State<DbState>, id: i64) -> Result<db::Folder, String> {
    let conn = state.0.lock().unwrap();
    db::get_folder_by_id(&conn, id)
}

#[tauri::command]
fn cmd_get_password_by_id(state: tauri::State<DbState>, id: i64) -> Result<db::Password, String> {
    let conn = state.0.lock().unwrap();
    db::get_password_by_id(&conn, id)
}

#[tauri::command]
fn cmd_insert_folder(state: tauri::State<DbState>, name: &str, father_id: Option<i64>) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    db::insert_folder(&conn, name, father_id)
}

#[tauri::command]
fn cmd_insert_password(state: tauri::State<DbState>, name: &str, login: &str, password: &str, url: &str, father_id: Option<i64>) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    db::insert_password(&conn, name, login, password, url, father_id)
}

#[tauri::command]
fn cmd_update_folder(state: tauri::State<DbState>, id: i64, name: &str, father_id: Option<i64>) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    db::update_folder(&conn, id, name, father_id)
}

#[tauri::command]
fn cmd_update_password(state: tauri::State<DbState>, id: i64, name: &str, login: &str, password: &str, url: &str, father_id: Option<i64>) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    db::update_password(&conn, id, name, login, password, url, father_id)
}

#[tauri::command]
fn cmd_delete_folder(state: tauri::State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    db::delete_folder(&conn, id)
}

#[tauri::command]
fn cmd_delete_password(state: tauri::State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    db::delete_password(&conn, id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
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
}