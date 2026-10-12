import Link from "next/link";

// §7 generic 404, also used for notes the user doesn't own (D24).
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        This page doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Link href="/" className="mt-6 inline-block font-medium underline">
        Go to TinyNotes
      </Link>
    </main>
  );
}
