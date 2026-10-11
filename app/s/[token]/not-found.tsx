export default function SharedNoteNotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">This note isn&apos;t available</h1>
      <p className="mt-4 text-zinc-600">
        The link may be wrong, or the owner stopped sharing it.
      </p>
    </main>
  );
}
