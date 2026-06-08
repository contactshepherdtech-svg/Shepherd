"use client";

import { memo, type ReactNode } from "react";

/**
 * Lightweight markdown renderer for assistant replies.
 * Intentionally small — handles the subset the model actually emits
 * (headings, bullet/numbered lists, bold, inline code, paragraphs) and
 * turns it into clean, well-spaced UI instead of raw asterisks/hashes.
 * No external dependency.
 */

// Inline: **bold** and `code`. Returns React nodes with no stray markers.
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[2] !== undefined) {
      nodes.push(
        <strong key={key++} className="font-semibold text-foreground">
          {match[2]}
        </strong>,
      );
    } else if (match[3] !== undefined) {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {match[3]}
        </code>,
      );
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

const stripBullet = (line: string) => line.replace(/^\s*[-*•]\s+/, "");
const stripOrdered = (line: string) => line.replace(/^\s*\d+[.)]\s+/, "");
const isBullet = (line: string) => /^\s*[-*•]\s+/.test(line);
const isOrdered = (line: string) => /^\s*\d+[.)]\s+/.test(line);
const isHeading = (line: string) => /^\s*#{1,6}\s+/.test(line);

function FormattedMessageImpl({ content }: { content: string }) {
  // Group consecutive lines into blocks (paragraphs, lists, headings).
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (isHeading(line)) {
      blocks.push(
        <p key={key++} className="text-sm font-semibold tracking-tight text-foreground">
          {renderInline(line.replace(/^\s*#{1,6}\s+/, ""))}
        </p>,
      );
      i++;
      continue;
    }

    if (isBullet(line)) {
      const items: string[] = [];
      while (i < lines.length && isBullet(lines[i])) {
        items.push(stripBullet(lines[i]));
        i++;
      }
      blocks.push(
        <ul key={key++} className="space-y-1.5 pl-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-2">
              <span className="mt-[0.55em] size-1 shrink-0 rounded-full bg-primary/50" />
              <span className="flex-1">{renderInline(item)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (isOrdered(line)) {
      const items: string[] = [];
      while (i < lines.length && isOrdered(lines[i])) {
        items.push(stripOrdered(lines[i]));
        i++;
      }
      blocks.push(
        <ol key={key++} className="space-y-1.5">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-2.5">
              <span className="font-medium text-muted-foreground tabular-nums">{idx + 1}.</span>
              <span className="flex-1">{renderInline(item)}</span>
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // Paragraph: gather contiguous non-blank, non-list lines.
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !isBullet(lines[i]) &&
      !isOrdered(lines[i]) &&
      !isHeading(lines[i])
    ) {
      paragraph.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p key={key++} className="leading-relaxed">
        {renderInline(paragraph.join(" "))}
      </p>,
    );
  }

  return <div className="space-y-3">{blocks}</div>;
}

export const FormattedMessage = memo(FormattedMessageImpl);
