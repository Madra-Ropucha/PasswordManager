// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod generator;
mod breach_check;

use generator::{generate_password, PasswordOptions};
use breach_check::BreachChecker;

fn main() {
    passwordmanager_lib::run();
    // 1️⃣ Crear opciones de contraseña
    let options = PasswordOptions {
        length: 16,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
    };

    // 2️⃣ Generar contraseña
    let password = generate_password(&options).unwrap();
    println!("Generated password: {}", password);

    // 3️⃣ Inicializar el comprobador de filtración
    let mut checker = BreachChecker::new();

    // 4️⃣ Comprobar si la contraseña ha sido filtrada
    match checker.check_password(&password) {
        Ok(Some(count)) => println!("⚠️ Password leaked {} times!", count),
        Ok(None) => println!("✅ Password not found in breaches"),
        Err(e) => println!("Error checking password: {}", e),
    }

    // 🔹 Opcional: en la app final, la UI decidirá
    // si quiere generar, comprobar o ambas cosas
}