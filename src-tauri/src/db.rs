use rusqlite::Connection;
use rusqlite::{Connection, Row};
use serde::{Serialize, Deserialize};

// Structs
#[derive(Serialize, Deserialize)]
pub struct Folder {
    pub id: i64,
    pub name: String,
    pub father_id: Option<i64>,
    pub deleted_on: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct Password {   
    pub id: i64,
    pub name: String,
    pub login: Option<String>,
    pub password: Option<String>,
    pub url: Option<String>,
    pub father_id: Option<i64>,
    pub deleted_on: Option<String>,
}

// Mappers
fn row_to_folder(row: &Row) -> Result<Folder, rusqlite::Error> {
    Ok(Folder {
        id: row.get(0)?,
        name: row.get(1)?,
        father_id: row.get(2)?,
        deleted_on: row.get(3)?,
    })
}

fn row_to_password(row: &Row) -> Result<Password, rusqlite::Error> {
    Ok(Password {
        id: row.get(0)?,
        name: row.get(1)?,
        login: row.get(2)?,
        password: row.get(3)?,
        url: row.get(4)?,
        father_id: row.get(5)?,
        deleted_on: row.get(6)?,
    })
}

pub fn init_db(db_path: &str) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    conn.execute_batch("
        PRAGMA foreign_keys = ON;

        DROP TABLE IF EXISTS password;
        DROP TABLE IF EXISTS folder;

        CREATE TABLE IF NOT EXISTS folder (
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            name TEXT NOT NULL,
            fatherId INTEGER,
            deletedOn TEXT,
            FOREIGN KEY (fatherId) REFERENCES folder(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS password (
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            name TEXT NOT NULL,
            login TEXT,
            password TEXT,
            url TEXT,
            fatherId INTEGER,
            deletedOn TEXT,
            FOREIGN KEY (fatherId) REFERENCES folder(id) ON DELETE SET NULL
        );
    ").map_err(|e| e.to_string())?;

    Ok(())
}

// SELECT all root folders (no parent)
pub fn get_root_folders(conn: &Connection) -> Result<Vec<Folder>, String> {
    let mut stmt = conn.prepare(
        "SELECT * FROM folder WHERE fatherId IS NULL AND deletedOn IS NULL"
    ).map_err(|e| e.to_string())?;

    let folders = stmt.query_map([], |row| row_to_folder(row))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(folders)
}

// SELECT all folders inside a folder
pub fn get_folders_by_parent(conn: &Connection, father_id: i64) -> Result<Vec<Folder>, String> {
    let mut stmt = conn.prepare(
        "SELECT * FROM folder WHERE fatherId = ?1 AND deletedOn IS NULL"
    ).map_err(|e| e.to_string())?;

    let folders = stmt.query_map([father_id], |row| row_to_folder(row))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(folders)
}

// SELECT all passwords inside a folder
pub fn get_passwords_by_folder(conn: &Connection, father_id: i64) -> Result<Vec<Password>, String> {
    let mut stmt = conn.prepare(
        "SELECT * FROM password WHERE fatherId = ?1 AND deletedOn IS NULL"
    ).map_err(|e| e.to_string())?;

    let passwords = stmt.query_map([father_id], |row| row_to_password(row))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(passwords)
}

// SELECT a single folder by id
pub fn get_folder_by_id(conn: &Connection, id: i64) -> Result<Folder, String> {
    conn.query_row(
        "SELECT * FROM folder WHERE id = ?1",
        [id],
        |row| row_to_folder(row),
    ).map_err(|e| e.to_string())
}

// SELECT a single password by id
pub fn get_password_by_id(conn: &Connection, id: i64) -> Result<Password, String> {
    conn.query_row(
        "SELECT * FROM password WHERE id = ?1",
        [id],
        |row| row_to_password(row),
    ).map_err(|e| e.to_string())
}

// INSERT folder
pub fn insert_folder(conn: &Connection, name: &str, father_id: Option<i64>) -> Result<(), String> {
    conn.execute(
        "INSERT INTO folder (name, fatherId) VALUES (?1, ?2)",
        (name, father_id),
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// INSERT password
pub fn insert_password(conn: &Connection, name: &str, login: &str, password: &str, url: &str, father_id: Option<i64>) -> Result<(), String> {
    conn.execute(
        "INSERT INTO password (name, login, password, url, fatherId) VALUES (?1, ?2, ?3, ?4, ?5)",
        (name, login, password, url, father_id),
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// UPDATE folder
pub fn update_folder(conn: &Connection, id: i64, name: &str, father_id: Option<i64>) -> Result<(), String> {
    conn.execute(
        "UPDATE folder SET name = ?1, fatherId = ?2 WHERE id = ?3",
        (name, father_id, id),
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// UPDATE password
pub fn update_password(conn: &Connection, id: i64, name: &str, login: &str, password: &str, url: &str, father_id: Option<i64>) -> Result<(), String> {
    conn.execute(
        "UPDATE password SET name = ?1, login = ?2, password = ?3, url = ?4, fatherId = ?5 WHERE id = ?6",
        (name, login, password, url, father_id, id),
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// DELETE folder
pub fn delete_folder(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute(
        "DELETE FROM folder WHERE id = ?1",
        [id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// DELETE password
pub fn delete_password(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute(
        "DELETE FROM password WHERE id = ?1",
        [id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
