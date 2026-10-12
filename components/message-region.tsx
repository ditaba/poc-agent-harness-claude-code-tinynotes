import { ERROR_MESSAGES, type ErrorCode } from "@/lib/errors";

export type Message = {
  kind: "status" | "error";
  text: string;
  // Opens in a new tab, so the current page keeps its state (R5).
  link?: { href: string; label: string };
};

// §7 copy for an action error. UNAUTHENTICATED gets a "Sign in" link.
export function errorMessage(error: ErrorCode): Message {
  return {
    kind: "error",
    text: ERROR_MESSAGES[error],
    link:
      error === "UNAUTHENTICATED"
        ? { href: "/sign-in", label: "Sign in" }
        : undefined,
  };
}

// Both live regions are always in the DOM so screen readers announce text
// put into them later (MSG-1). At most one of them holds a message (MSG-2).
export function MessageRegion({ message }: { message: Message | null }) {
  return (
    <div className="min-h-6 text-sm">
      <p role="status" className="text-zinc-700">
        {message?.kind === "status" ? message.text : null}
      </p>
      <p role="alert" className="text-red-700">
        {message?.kind === "error" ? (
          <>
            {message.text}
            {message.link ? (
              <>
                {" "}
                <a
                  href={message.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline"
                >
                  {message.link.label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </>
            ) : null}
          </>
        ) : null}
      </p>
    </div>
  );
}
