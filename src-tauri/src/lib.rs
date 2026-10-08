use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;

fn connect(path: &Path) -> Result<Connection, String> {
    let connection = Connection::open(path).map_err(|e| e.to_string())?;
    connection.busy_timeout(std::time::Duration::from_secs(5)).map_err(|e| e.to_string())?;
    connection.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS agenda (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);").map_err(|e| e.to_string())?;
    Ok(connection)
}
pub fn load(path: &Path) -> Result<Option<String>, String> {
    connect(path)?.query_row("SELECT data FROM agenda WHERE id=1", [], |row| row.get(0)).optional().map_err(|e| e.to_string())
}
pub fn save(path: &Path, data: &str) -> Result<(), String> {
    let parsed: serde_json::Value = serde_json::from_str(data).map_err(|e| e.to_string())?;
    if parsed.get("version").and_then(|v| v.as_u64()) != Some(1) { return Err("Versión de datos inválida".into()); }
    let mut connection = connect(path)?;
    let tx = connection.transaction().map_err(|e| e.to_string())?;
    tx.execute("INSERT INTO agenda (id,data) VALUES (1,?1) ON CONFLICT(id) DO UPDATE SET data=excluded.data", params![data]).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}
#[cfg(feature = "desktop")]
mod desktop {
    use super::*;
    use tauri::Manager;
    fn db_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
        let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        Ok(dir.join("montana.sqlite"))
    }
    #[tauri::command]
    fn load_state(app: tauri::AppHandle) -> Result<Option<String>, String> { load(&db_path(&app)?) }
    #[tauri::command]
    fn save_state(app: tauri::AppHandle, data: String) -> Result<(), String> { save(&db_path(&app)?, &data) }
    pub fn run() {
        tauri::Builder::default().plugin(tauri_plugin_notification::init())
            .invoke_handler(tauri::generate_handler![load_state, save_state])
            .run(tauri::generate_context!()).expect("No se pudo iniciar Montana Agenda");
    }
}
#[cfg(feature = "desktop")]
pub use desktop::run;
#[cfg(test)]
mod tests {
    use super::*;
    fn path() -> std::path::PathBuf { std::env::temp_dir().join(format!("montana-test-{}-{}.sqlite",std::process::id(),std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos())) }
    #[test]
    fn persists_after_reopening_and_updates_atomically() {
        let p=path(); assert_eq!(load(&p).unwrap(),None);
        save(&p,r#"{"version":1,"tasks":[{"name":"Revisar inventario"}]}"#).unwrap();
        assert!(load(&p).unwrap().unwrap().contains("Revisar inventario"));
        save(&p,r#"{"version":1,"tasks":[]}"#).unwrap();
        assert_eq!(load(&p).unwrap().unwrap(),r#"{"version":1,"tasks":[]}"#);
        std::fs::remove_file(p).unwrap();
    }
    #[test]
    fn invalid_write_preserves_previous_data() {
        let p=path();save(&p,r#"{"version":1}"#).unwrap();
        assert!(save(&p,"invalid").is_err());assert!(save(&p,r#"{"version":2}"#).is_err());
        assert_eq!(load(&p).unwrap().unwrap(),r#"{"version":1}"#);std::fs::remove_file(p).unwrap();
    }
}
