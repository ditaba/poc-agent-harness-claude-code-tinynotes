"use client";

import { useEffect, useState } from "react";
import { callAction } from "@/lib/call-action";
import { disableShareAction, enableShareAction } from "@/lib/notes/actions";
import { errorMessage, MessageRegion, type Message } from "./message-region";

const COPIED_MS = 2000;

export function SharePanel({
  noteId,
  initialShareUrl,
}: {
  noteId: string;
  initialShareUrl: string | null;
}) {
  // Starts from the page load, then changes only from this panel's own action
  // results. Later prop changes from revalidation are ignored (SHARE-7, D42).
  const [shareUrl, setShareUrl] = useState(initialShareUrl);
  const [pending, setPending] = useState<"enable" | "disable" | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleEnable() {
    setMessage(null);
    setPending("enable");
    const result = await callAction(() => enableShareAction(noteId));
    setPending(null);
    if (result.ok) setShareUrl(result.data.shareUrl);
    else setMessage(errorMessage(result.error));
  }

  async function handleDisable() {
    setMessage(null);
    setPending("disable");
    const result = await callAction(() => disableShareAction(noteId));
    setPending(null);
    if (result.ok) {
      setShareUrl(null);
      setCopied(false);
    } else {
      setMessage(errorMessage(result.error));
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage(null);
      setCopied(true);
    } catch {
      setCopied(false);
      setMessage({
        kind: "error",
        text: "Couldn't copy. Select the link and copy it manually.",
      });
    }
  }

  const buttonClass =
    "rounded border border-zinc-300 px-4 py-2 font-medium disabled:opacity-60 dark:border-zinc-700";

  return (
    <section
      aria-labelledby="sharing-heading"
      className="mt-8 flex flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800"
    >
      <h2 id="sharing-heading" className="text-lg font-semibold">
        Sharing
      </h2>
      {shareUrl === null ? (
        <>
          <p>This note is private.</p>
          <div>
            <button
              type="button"
              onClick={handleEnable}
              disabled={pending !== null}
              className={buttonClass}
            >
              {pending === "enable" ? "Creating link…" : "Create share link"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p>Anyone with this link can view this note.</p>
          <input
            type="text"
            readOnly
            aria-label="Share link"
            value={shareUrl}
            onFocus={(event) => event.target.select()}
            className="w-full rounded border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <div className="flex gap-4">
            <button type="button" onClick={handleCopy} className={buttonClass}>
              {copied ? "Copied!" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={handleDisable}
              disabled={pending !== null}
              className={buttonClass}
            >
              {pending === "disable" ? "Disabling…" : "Disable link"}
            </button>
          </div>
        </>
      )}
      <MessageRegion message={message} />
    </section>
  );
}
