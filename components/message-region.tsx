export type Message = { kind: "status" | "error"; text: string };

// Both live regions are always in the DOM so screen readers announce text
// put into them later (MSG-1). At most one of them holds a message (MSG-2).
export function MessageRegion({ message }: { message: Message | null }) {
  return (
    <div className="min-h-6 text-sm">
      <p role="status" className="text-zinc-700 dark:text-zinc-300">
        {message?.kind === "status" ? message.text : null}
      </p>
      <p role="alert" className="text-red-700 dark:text-red-400">
        {message?.kind === "error" ? message.text : null}
      </p>
    </div>
  );
}
