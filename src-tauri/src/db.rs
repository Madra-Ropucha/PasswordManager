use rusqlite::Connection;

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