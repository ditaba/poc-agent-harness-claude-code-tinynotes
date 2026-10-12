// Throwaway R1 spike (SPEC §14 M0): delete before merge.
import { Database } from "bun:sqlite";

export const dynamic = "force-dynamic";

export default function SpikePage() {
  const db = new Database(":memory:");
  const row = db.query("select sqlite_version() as version").get() as {
    version: string;
  };
  db.close();

  return (
    <main className="p-8">
      <h1>bun:sqlite spike</h1>
      <p>SQLite {row.version}</p>
    </main>
  );
}
