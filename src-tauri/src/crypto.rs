use aes_gcm::{
    aead::{rand_core::RngCore, Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use sha2::{Digest, Sha256};

pub fn key_from_password(password: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hasher.finalize().into()
}

pub fn encrypt_file(path: &str, key: &[u8; 32]) -> Result<(), String> {
    let contents = std::fs::read(path).map_err(|e| e.to_string())?;
    let output = encrypt_bytes(&contents, key)?;
    std::fs::write(path, output).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn decrypt_file(path: &str, key: &[u8; 32]) -> Result<Vec<u8>, String> {
    let contents = std::fs::read(path).map_err(|e| e.to_string())?;
    decrypt_bytes(&contents, key)
}

/// Devuelve un blob `nonce(12) + ciphertext`.
pub fn encrypt_bytes(plaintext: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new(key.into());

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let encrypted = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| e.to_string())?;

    let mut out = nonce_bytes.to_vec();
    out.extend_from_slice(&encrypted);
    Ok(out)
}

pub fn decrypt_bytes(blob: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, String> {
    if blob.len() < 12 {
        return Err("invalid encrypted blob".to_string());
    }
    let (nonce_bytes, encrypted) = blob.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);
    let cipher = Aes256Gcm::new(key.into());
    cipher
        .decrypt(nonce, encrypted)
        .map_err(|_| "decryption failed (wrong key?)".to_string())
}

pub fn hash_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    let result = hasher.finalize();
    format!("{:x}", result)  // converts bytes to hex string
}