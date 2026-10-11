import Link from "next/link";

// The generic 404 (§7): unknown routes, and notes that are missing or owned by someone else, which look
// the same so note existence never leaks (D24).
export default function NotFound() {
  return (
    <main className="page-container py-8">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-4 text-zinc-600">
        This page doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block font-medium text-zinc-900 underline"
      >
        Go to TinyNotes
      </Link>
    </main>
  );
}
