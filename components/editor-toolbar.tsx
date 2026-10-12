"use client";

import type { ChainedCommands, Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { useRef, useState, type KeyboardEvent } from "react";

type ToolbarButton = {
  label: string;
  ariaLabel: string;
  command: (chain: ChainedCommands) => ChainedCommands;
  // Format buttons are toggles with aria-pressed; Undo/Redo are not.
  active?: (editor: Editor) => boolean;
};

// NOTE-6: visible label → aria-label, in toolbar order (D4, D35).
const BUTTONS: ToolbarButton[] = [
  {
    label: "B",
    ariaLabel: "Bold",
    command: (chain) => chain.toggleBold(),
    active: (editor) => editor.isActive("bold"),
  },
  {
    label: "I",
    ariaLabel: "Italic",
    command: (chain) => chain.toggleItalic(),
    active: (editor) => editor.isActive("italic"),
  },
  {
    label: "S",
    ariaLabel: "Strikethrough",
    command: (chain) => chain.toggleStrike(),
    active: (editor) => editor.isActive("strike"),
  },
  {
    label: "<>",
    ariaLabel: "Inline code",
    command: (chain) => chain.toggleCode(),
    active: (editor) => editor.isActive("code"),
  },
  {
    label: "H2",
    ariaLabel: "Heading 2",
    command: (chain) => chain.toggleHeading({ level: 2 }),
    active: (editor) => editor.isActive("heading", { level: 2 }),
  },
  {
    label: "H3",
    ariaLabel: "Heading 3",
    command: (chain) => chain.toggleHeading({ level: 3 }),
    active: (editor) => editor.isActive("heading", { level: 3 }),
  },
  {
    label: "• List",
    ariaLabel: "Bullet list",
    command: (chain) => chain.toggleBulletList(),
    active: (editor) => editor.isActive("bulletList"),
  },
  {
    label: "1. List",
    ariaLabel: "Numbered list",
    command: (chain) => chain.toggleOrderedList(),
    active: (editor) => editor.isActive("orderedList"),
  },
  {
    label: "Quote",
    ariaLabel: "Quote",
    command: (chain) => chain.toggleBlockquote(),
    active: (editor) => editor.isActive("blockquote"),
  },
  {
    label: "Code",
    ariaLabel: "Code block",
    command: (chain) => chain.toggleCodeBlock(),
    active: (editor) => editor.isActive("codeBlock"),
  },
  { label: "Undo", ariaLabel: "Undo", command: (chain) => chain.undo() },
  { label: "Redo", ariaLabel: "Redo", command: (chain) => chain.redo() },
];

export function EditorToolbar({ editor }: { editor: Editor }) {
  // Re-read on every editor transaction, so pressed/disabled never go stale.
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      BUTTONS.map((button) => ({
        pressed: button.active?.(current),
        enabled: button.command(current.can().chain()).run(),
      })),
  });
  // Roving tabindex: the toolbar is one Tab stop, and tabbing back in lands
  // on the last-focused button (D43).
  const [focusIndex, setFocusIndex] = useState(0);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function moveFocus(index: number) {
    const next = (index + BUTTONS.length) % BUTTONS.length;
    setFocusIndex(next);
    buttonRefs.current[next]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const targets: Record<string, number> = {
      ArrowRight: focusIndex + 1,
      ArrowLeft: focusIndex - 1,
      Home: 0,
      End: BUTTONS.length - 1,
    };
    if (!(event.key in targets)) return;
    event.preventDefault();
    moveFocus(targets[event.key]);
  }

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      onKeyDown={handleKeyDown}
      className="flex flex-wrap gap-1"
    >
      {BUTTONS.map((button, index) => {
        const { pressed, enabled } = state[index];
        return (
          <button
            key={button.ariaLabel}
            ref={(element) => {
              buttonRefs.current[index] = element;
            }}
            type="button"
            tabIndex={index === focusIndex ? 0 : -1}
            aria-label={button.ariaLabel}
            aria-pressed={button.active ? pressed : undefined}
            // aria-disabled keeps unavailable buttons focusable (D43).
            aria-disabled={!enabled || undefined}
            onFocus={() => setFocusIndex(index)}
            // Keeps the editor selection when clicking with the mouse.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (!enabled) return;
              button.command(editor.chain().focus()).run();
            }}
            className="rounded border border-zinc-300 px-2 py-1 text-sm font-medium aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:border-zinc-700 dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900"
          >
            {button.label}
          </button>
        );
      })}
    </div>
  );
}
