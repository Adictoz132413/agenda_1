import { invoke, isTauri } from "@tauri-apps/api/core";
import initSqlJs, { type Database } from "sql.js";
import { initialState, validateState, type State } from "./domain";
let db: Database;
let idb: IDBDatabase;
const request = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
async function openWeb() {
  const SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
  const req = indexedDB.open("montana-agenda", 1);
  req.onupgradeneeded = () => req.result.createObjectStore("database");
  idb = await request(req);
  const bytes = (await request(
    idb.transaction("database").objectStore("database").get("sqlite"),
  )) as Uint8Array | undefined;
  db = bytes ? new SQL.Database(bytes) : new SQL.Database();
  db.run(
    "CREATE TABLE IF NOT EXISTS agenda (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)",
  );
  const result = db.exec("SELECT data FROM agenda WHERE id=1");
  return result[0]?.values[0]?.[0] as string | undefined;
}
export async function load(): Promise<State> {
  const raw = isTauri()
    ? await invoke<string | null>("load_state")
    : await openWeb();
  if (!raw) return initialState();
  const parsed: unknown = JSON.parse(raw);
  if (!validateState(parsed))
    throw new Error(
      "La base de datos tiene un formato incompatible. No se sobrescribirá.",
    );
  return parsed;
}
export async function save(state: State) {
  const raw = JSON.stringify(state);
  if (isTauri()) {
    await invoke("save_state", { data: raw });
    return;
  }
  db.run(
    "INSERT INTO agenda(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
    [raw],
  );
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction("database", "readwrite");
    tx.objectStore("database").put(db.export(), "sqlite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
