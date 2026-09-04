/**
 * Parsing the release notes for the update window.
 *
 * The notes arrive inside `latest.json` as a single string, assembled by the
 * release tooling from a markdown file. The parsing is deliberately primitive:
 * a line starting with "-" or "•" is a list item, "# " is a heading, a blank
 * line is a paragraph boundary. Dragging in a full markdown engine for a letter
 * three paragraphs long would be silly, and this handles any text — including
 * the old one-line note from an earlier version — without losing anything.
 */

export type NotesBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

export function parseNotes(notes: string): NotesBlock[] {
  const blocks: NotesBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push({ kind: "list", items: list });
      list = [];
    }
  };

  for (const raw of (notes ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flushList();
      flushParagraph();
      continue;
    }

    const bullet = /^[-•*]\s+(.*)$/.exec(line);
    if (bullet) {
      // The paragraph before a list is closed, but the list keeps accumulating:
      // adjacent items belong in one <ul>, not in ten in a row.
      flushParagraph();
      list.push(bullet[1]);
      continue;
    }

    const heading = /^#{1,3}\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      flushParagraph();
      blocks.push({ kind: "heading", text: heading[1] });
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushList();
  flushParagraph();
  return blocks;
}
