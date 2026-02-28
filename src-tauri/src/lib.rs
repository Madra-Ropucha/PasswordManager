use std::fs::File;
mod crypto;
mod db;

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
        .invoke_handler(tauri::generate_handler![greet, encrypt, decrypt, hash_password])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}