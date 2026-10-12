import type { Client, InValue, Transaction } from "@libsql/client";
import {
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type DialectAdapter,
  type Driver,
  type Kysely,
  type QueryCompiler,
  type QueryResult,
} from "kysely";
import { rowsOf } from "./open-database";

// better-auth talks to the database through Kysely; this dialect lets it share the app's libsql client
// (D29, D49). Kysely asks for a connection per query or transaction: a query outside a transaction goes
// straight to the client, and a transaction gets its own libsql transaction.
export class LibsqlDialect implements Dialect {
  readonly #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  createAdapter(): DialectAdapter {
    return new SqliteAdapter();
  }

  createDriver(): Driver {
    return new LibsqlDriver(this.#client);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Kysely's own signature
  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    return new SqliteIntrospector(db);
  }

  createQueryCompiler(): QueryCompiler {
    return new SqliteQueryCompiler();
  }
}

class LibsqlDriver implements Driver {
  readonly #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  async init(): Promise<void> {}

  async acquireConnection(): Promise<LibsqlConnection> {
    return new LibsqlConnection(this.#client);
  }

  async beginTransaction(connection: LibsqlConnection): Promise<void> {
    await connection.begin();
  }

  async commitTransaction(connection: LibsqlConnection): Promise<void> {
    await connection.commit();
  }

  async rollbackTransaction(connection: LibsqlConnection): Promise<void> {
    await connection.rollback();
  }

  async releaseConnection(): Promise<void> {}

  // The client belongs to lib/db.ts, which keeps it open for the app's lifetime.
  async destroy(): Promise<void> {}
}

class LibsqlConnection implements DatabaseConnection {
  readonly #client: Client;
  #transaction: Transaction | null = null;

  constructor(client: Client) {
    this.#client = client;
  }

  async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
    const result = await (this.#transaction ?? this.#client).execute({
      sql: query.sql,
      args: query.parameters as InValue[],
    });
    return {
      rows: rowsOf<R>(result),
      numAffectedRows: BigInt(result.rowsAffected),
      insertId: result.lastInsertRowid,
    };
  }

  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error(
      "Streaming queries aren't supported by the libsql dialect.",
    );
  }

  async begin(): Promise<void> {
    this.#transaction = await this.#client.transaction("write");
  }

  async commit(): Promise<void> {
    try {
      await this.#transaction?.commit();
    } finally {
      this.#end();
    }
  }

  async rollback(): Promise<void> {
    try {
      await this.#transaction?.rollback();
    } finally {
      this.#end();
    }
  }

  // Commit and rollback normally close the transaction themselves; this covers the ones that throw.
  #end(): void {
    this.#transaction?.close();
    this.#transaction = null;
  }
}
