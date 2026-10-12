import { createClient, type Client, type ResultSet } from "@libsql/client";

// No side effects on import (D45): only openDatabase() opens a client. libSQL turns
// foreign keys on by default; `timeout` is the busy timeout for file: databases (D49).
export function openDatabase(url: string, authToken?: string): Client {
  return createClient({ url, authToken, timeout: 5000 });
}

// libSQL rows also carry index keys and `length`; this returns plain
// { column: value } objects, typed with the row shape the caller names.
export function rowsOf<T>(result: ResultSet): T[] {
  return result.rows.map(
    (row) =>
      Object.fromEntries(
        result.columns.map((column, index) => [column, row[index]]),
      ) as T,
  );
}
