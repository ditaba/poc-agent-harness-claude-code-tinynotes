import type { ReactNode } from "react";

export type Message = { type: "status" | "error"; content: ReactNode };

// MSG-1/MSG-2: both live regions are always rendered, empty until used, so screen readers announce what is
// put in them later. A region shows at most one message, a status or an error.
export function MessageRegion({ message }: { message: Message | null }) {
  return (
    <div className="text-sm">
      <p role="status" className="text-green-700">
        {message?.type === "status" && message.content}
      </p>
      <p role="alert" className="text-red-700">
        {message?.type === "error" && message.content}
      </p>
    </div>
  );
}
