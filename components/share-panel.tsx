"use client";

import { useEffect, useState, useTransition } from "react";
import { callAction } from "@/lib/call-action";
import { ERROR_MESSAGES, type ErrorCode } from "@/lib/errors";
import { disableShareAction, enableShareAction } from "@/lib/notes/actions";
import { MessageRegion, type Message } from "./message-region";

type Props = { noteId: string; initialShareUrl: string | null };

export function SharePanel({ noteId, initialShareUrl }: Props) {
  // D42: revalidated props must not replace this tab's state. Only our action results do.
  const [shareUrl, setShareUrl] = useState(initialShareUrl);
  const [message, setMessage] = useState<Message | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreating, startCreating] = useTransition();
  const [isDisabling, startDisabling] = useTransition();
  const isPending = isCreating || isDisabling;

  // The clipboard feedback has a lifetime; clean up the timer on reset or unmount.
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2_000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  function showError(code: ErrorCode) {
    setMessage({
      type: "error",
      content:
        code === "UNAUTHENTICATED" ? (
          <>
            {ERROR_MESSAGES[code]}{" "}
            <a
              href="/sign-in"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Sign in
            </a>
          </>
        ) : (
          ERROR_MESSAGES[code]
        ),
    });
  }

  function handleCreate() {
    setMessage(null);
    setCopied(false);
    startCreating(async () => {
      const result = await callAction(() => enableShareAction(noteId));
      startCreating(() => {
        if (result.ok) setShareUrl(result.data.shareUrl);
        else showError(result.error);
      });
    });
  }

  function handleDisable() {
    setMessage(null);
    setCopied(false);
    startDisabling(async () => {
      const result = await callAction(() => disableShareAction(noteId));
      startDisabling(() => {
        if (result.ok) setShareUrl(null);
        else showError(result.error);
      });
    });
  }

  async function handleCopy() {
    setMessage(null);
    setCopied(false);
    if (!shareUrl) return;
    try {
      if (!("clipboard" in navigator)) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setMessage({
        type: "error",
        content: "Couldn't copy. Select the link and copy it manually.",
      });
    }
  }

  return (
    <section
      aria-labelledby="sharing-heading"
      className="mt-8 flex flex-col gap-3 border-t border-zinc-200 pt-6"
    >
      <h2 id="sharing-heading" className="text-lg font-semibold">
        Sharing
      </h2>
      {shareUrl ? (
        <>
          <p>Anyone with this link can view this note.</p>
          <input
            type="url"
            aria-label="Share link"
            readOnly
            value={shareUrl}
            className="min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2"
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCopy}
              disabled={isPending}
              className="rounded-md border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 disabled:opacity-60"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={handleDisable}
              disabled={isPending}
              className="rounded-md border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 disabled:opacity-60"
            >
              {isDisabling ? "Disabling…" : "Disable link"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p>This note is private.</p>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending}
            className="self-start rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
          >
            {isCreating ? "Creating link…" : "Create share link"}
          </button>
        </>
      )}
      <MessageRegion message={message} />
    </section>
  );
}
