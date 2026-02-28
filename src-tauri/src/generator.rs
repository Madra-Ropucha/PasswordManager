use rand::rngs::OsRng;
use rand::seq::SliceRandom;
use rand::Rng;

const LOWERCASE: &[u8] = b"abcdefghijklmnopqrstuvwxyz";
const UPPERCASE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const NUMBERS: &[u8] = b"0123456789";
const SYMBOLS: &[u8] = b"!@#$%^&*()-_=+[]{}<>?";


fn build_charset(options: &PasswordOptions) -> String {
    let mut charset = String::new();

    if options.lowercase {
        charset.push_str(LOWERCASE);
    }

    if options.uppercase {
        charset.push_str(UPPERCASE);
    }

    if options.numbers {
        charset.push_str(NUMBERS);
    }

    if options.symbols {
        charset.push_str(SYMBOLS);
    }

    charset
}

pub fn generate_password(options: &PasswordOptions) -> Result<String, String> {
    let mut rng = OsRng;
    let mut password: Vec<u8> = Vec::new();
    let mut pool: Vec<u8> = Vec::new();

    if options.lowercase {
        pool.extend_from_slice(LOWERCASE);
        password.push(*LOWERCASE.choose(&mut rng).unwrap());
    }

    if options.uppercase {
        pool.extend_from_slice(UPPERCASE);
        password.push(*UPPERCASE.choose(&mut rng).unwrap());
    }

    if options.numbers {
        pool.extend_from_slice(NUMBERS);
        password.push(*NUMBERS.choose(&mut rng).unwrap());
    }

    if options.symbols {
        pool.extend_from_slice(SYMBOLS);
        password.push(*SYMBOLS.choose(&mut rng).unwrap());
    }

    if pool.is_empty() {
        return Err("At least one character type must be selected".into());
    }

    while password.len() < options.length {
        password.push(*pool.choose(&mut rng).unwrap());
    }

    password.shuffle(&mut rng);

    Ok(String::from_utf8(password).unwrap())
}



