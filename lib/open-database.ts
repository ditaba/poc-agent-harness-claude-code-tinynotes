import { createClient, type Client, type ResultSet } from "@libsql/client";

// No side effects on import: only lib/db.ts opens TURSO_DATABASE_URL (D45). libsql turns foreign keys
// on by default, and `timeout` is the busy timeout for local file: databases (D49).
export function openDatabase(url: string, authToken?: string): Client {
  return createClient({ url, authToken, timeout: 5000 });
}

// libsql rows also carry index keys and `length`. This returns plain { column: value } objects, typed
// with the row shape the caller names.
export function rowsOf<T>(result: ResultSet): T[] {
  return result.rows.map(
    (row) =>
      Object.fromEntries(
        result.columns.map((column, index) => [column, row[index]]),
      ) as T,
  );
}
