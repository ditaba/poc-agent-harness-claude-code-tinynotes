"use client";

// §7: unhandled render errors, including an unexpected error in createNoteAction.
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page-container py-16 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
      >
        Try again
      </button>
    </main>
  );
}
