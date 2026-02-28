use sha2::{Sha256, Digest};

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
    aead::rand_core::RngCore,
};
use sha2::{Sha256, Digest};

pub fn key_from_password(password: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hasher.finalize().into()
}

pub fn encrypt_file(path: &str, key: &[u8; 32]) -> Result<(), String> {
    let contents = std::fs::read(path).map_err(|e| e.to_string())?;
    let cipher = Aes256Gcm::new(key.into());

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let encrypted = cipher.encrypt(nonce, contents.as_ref())
        .map_err(|e| e.to_string())?;

    let mut output = nonce_bytes.to_vec();
    output.extend_from_slice(&encrypted);
    std::fs::write(path, output).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn decrypt_file(path: &str, key: &[u8; 32]) -> Result<Vec<u8>, String> {
    let contents = std::fs::read(path).map_err(|e| e.to_string())?;
    let (nonce_bytes, encrypted) = contents.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let cipher = Aes256Gcm::new(key.into());
    let decrypted = cipher.decrypt(nonce, encrypted)
        .map_err(|_| "decryption failed (wrong key?)".to_string())?;

    Ok(decrypted)
}

pub fn hash_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    let result = hasher.finalize();
    format!("{:x}", result)  // converts bytes to hex string
}