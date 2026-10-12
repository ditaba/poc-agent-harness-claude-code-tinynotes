// Shared-link 404 for malformed, unknown or disabled tokens (PUB-2).
export default function SharedNoteNotFound() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">This note isn&apos;t available</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        The link may be wrong, or the owner stopped sharing it.
      </p>
    </main>
  );
}
