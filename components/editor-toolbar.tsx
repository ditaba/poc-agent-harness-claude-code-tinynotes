"use client";

import type { ChainedCommands, Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type FocusEvent,
} from "react";

type ToolbarButton = {
  label: string;
  name: string;
  active?: (editor: Editor) => boolean;
  command: (chain: ChainedCommands) => ChainedCommands;
};

const BUTTONS: ToolbarButton[] = [
  {
    label: "B",
    name: "Bold",
    active: (editor) => editor.isActive("bold"),
    command: (chain) => chain.toggleBold(),
  },
  {
    label: "I",
    name: "Italic",
    active: (editor) => editor.isActive("italic"),
    command: (chain) => chain.toggleItalic(),
  },
  {
    label: "S",
    name: "Strikethrough",
    active: (editor) => editor.isActive("strike"),
    command: (chain) => chain.toggleStrike(),
  },
  {
    label: "<>",
    name: "Inline code",
    active: (editor) => editor.isActive("code"),
    command: (chain) => chain.toggleCode(),
  },
  {
    label: "H2",
    name: "Heading 2",
    active: (editor) => editor.isActive("heading", { level: 2 }),
    command: (chain) => chain.toggleHeading({ level: 2 }),
  },
  {
    label: "H3",
    name: "Heading 3",
    active: (editor) => editor.isActive("heading", { level: 3 }),
    command: (chain) => chain.toggleHeading({ level: 3 }),
  },
  {
    label: "• List",
    name: "Bullet list",
    active: (editor) => editor.isActive("bulletList"),
    command: (chain) => chain.toggleBulletList(),
  },
  {
    label: "1. List",
    name: "Numbered list",
    active: (editor) => editor.isActive("orderedList"),
    command: (chain) => chain.toggleOrderedList(),
  },
  {
    label: "Quote",
    name: "Quote",
    active: (editor) => editor.isActive("blockquote"),
    command: (chain) => chain.toggleBlockquote(),
  },
  {
    label: "Code",
    name: "Code block",
    active: (editor) => editor.isActive("codeBlock"),
    command: (chain) => chain.toggleCodeBlock(),
  },
  { label: "Undo", name: "Undo", command: (chain) => chain.undo() },
  { label: "Redo", name: "Redo", command: (chain) => chain.redo() },
];

export function EditorToolbar({ editor }: { editor: Editor }) {
  const [focusIndex, setFocusIndex] = useState(0);
  const buttons = useEditorState({
    editor,
    selector: ({ editor }) =>
      BUTTONS.map((button) => ({
        pressed: button.active?.(editor),
        available: button.command(editor.can().chain()).run(),
      })),
  });

  function handleFocus(event: FocusEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLButtonElement) {
      setFocusIndex(Number(event.target.dataset.index));
    }
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof HTMLButtonElement)) return;
    const button = BUTTONS[Number(event.target.dataset.index)];
    if (button && button.command(editor.can().chain()).run()) {
      button.command(editor.chain().focus()).run();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!(event.target instanceof HTMLButtonElement)) return;
    const index = Number(event.target.dataset.index);
    let next: number;
    switch (event.key) {
      case "ArrowLeft":
        next = (index + BUTTONS.length - 1) % BUTTONS.length;
        break;
      case "ArrowRight":
        next = (index + 1) % BUTTONS.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = BUTTONS.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    event.currentTarget.querySelectorAll("button")[next]?.focus();
  }

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      onFocus={handleFocus}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="flex flex-wrap gap-1 rounded-md border border-zinc-300 bg-white p-2"
    >
      {BUTTONS.map((button, index) => (
        <button
          key={button.name}
          type="button"
          data-index={index}
          aria-label={button.name}
          aria-pressed={buttons[index].pressed}
          aria-disabled={!buttons[index].available}
          tabIndex={focusIndex === index ? 0 : -1}
          className="rounded px-3 py-2 font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-700 aria-disabled:opacity-40 aria-disabled:focus-visible:opacity-100 aria-pressed:bg-zinc-900 aria-pressed:text-white"
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}
