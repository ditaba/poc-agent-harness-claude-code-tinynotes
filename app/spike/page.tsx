import { Database } from "bun:sqlite";

// Throwaway R1 spike (M0): proves bun:sqlite works inside Next. Deleted in M0-close.
export const dynamic = "force-dynamic";

export default function SpikePage() {
  const db = new Database(":memory:");
  const row = db.query("select sqlite_version() as version").get() as {
    version: string;
  };
  db.close();

  return (
    <main>
      <p>
        sqlite_version: <span id="sqlite-version">{row.version}</span>
      </p>
      <p>runtime: bun {Bun.version}</p>
    </main>
  );
}
