use sha1::{Digest, Sha1};
use reqwest::blocking::get;
use std::collections::HashMap;

pub struct BreachChecker {
    cache: HashMap<String, HashMap<String, u32>>
}

impl BreachChecker {

    pub fn new() -> Self {
        Self {
            cache: HashMap::new(),
        }
    }

    pub fn check_password(&mut self, password: &str) -> Result<Option<u32>, Box<dyn std::error::Error>> {

        let mut hasher = Sha1::new();
        hasher.update(password.as_bytes());
        let hash = format!("{:X}", hasher.finalize());

        let prefix = &hash[..5];
        let suffix = &hash[5..];

        // si no está en cache, pedir a API
        if !self.cache.contains_key(prefix) {

            let url = format!("https://api.pwnedpasswords.com/range/{}", prefix);
            let response = get(url)?.text()?;

            let mut entries = Vec::new();

            for line in response.lines() {

                let mut parts = line.split(':');
                let hash_suffix = parts.next().unwrap().to_string();
                let count = parts.next().unwrap().parse::<u32>()?;

                entries.push((hash_suffix, count));
            }

            self.cache.insert(prefix.to_string(), entries);
        }

        // buscar en cache
        if let Some(entries) = self.cache.get(prefix) {

            for (hash_suffix, count) in entries {

                if hash_suffix == suffix {
                    return Ok(Some(*count));
                }
            }
        }

        Ok(None)
    }
}