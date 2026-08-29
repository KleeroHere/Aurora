import type { EditorJsBlock, EditorJsOutputData } from "./types";

type RawBlock = { id?: string; type: string; data: Record<string, unknown> };
type RawOutputData = { time: number; blocks: RawBlock[]; version: string };

export function toStorageBlocks(raw: RawOutputData): EditorJsBlock[] {
  const blocks: EditorJsBlock[] = [];

  for (const block of raw.blocks) {
    const d = block.data;
    switch (block.type) {
      case "header":
        blocks.push({ type: "header", data: { text: String(d.text ?? ""), level: Number(d.level ?? 2) } });
        break;
      case "paragraph":
        blocks.push({ type: "paragraph", data: { text: String(d.text ?? "") } });
        break;
      case "list":
        blocks.push({
          type: "list",
          data: d as unknown as Extract<EditorJsBlock, { type: "list" }>["data"],
        });
        break;
      case "quote":
        blocks.push({ type: "quote", data: { text: String(d.text ?? ""), caption: String(d.caption ?? "") } });
        break;
      case "alert":
        blocks.push({
          type: "alert",
          data: {
            type: d.type === "danger" ? "danger" : "warning",
            align: String(d.align ?? "left"),
            text: String(d.message ?? ""),
          },
        });
        break;
      case "image": {
        const file = (d.file ?? {}) as Record<string, unknown>;
        blocks.push({
          type: "image",
          data: { file: { key: String(file.key ?? "") }, caption: String(d.caption ?? "") },
        });
        break;
      }
      case "attaches": {
        const file = (d.file ?? {}) as Record<string, unknown>;
        blocks.push({
          type: "attaches",
          data: {
            file: {
              key: String(file.key ?? ""),
              name: String(file.name ?? ""),
              ext: String(file.extension ?? ""),
              size: Number(file.size ?? 0),
            },
            title: String(d.title ?? ""),
          },
        });
        break;
      }
      case "table": {
        const rows = Array.isArray(d.content) ? (d.content as unknown[]) : [];
        blocks.push({
          type: "table",
          data: {
            withHeadings: Boolean(d.withHeadings),
            content: rows.map((row) =>
              (Array.isArray(row) ? row : []).map((cell) => String(cell ?? "")),
            ),
          },
        });
        break;
      }
      default:
        break;
    }
  }

  return blocks;
}

export function toStorageOutputData(raw: RawOutputData): EditorJsOutputData {
  return { time: raw.time, blocks: toStorageBlocks(raw), version: raw.version };
}

export async function toEditorBlocks(
  blocks: EditorJsBlock[],
  resolveAttachmentUrl: (key: string) => Promise<string>,
): Promise<RawBlock[]> {
  const safeUrl = async (key: string): Promise<string> => {
    try {
      return await resolveAttachmentUrl(key);
    } catch {
      return "";
    }
  };

  return Promise.all(
    blocks.map(async (block): Promise<RawBlock> => {
      switch (block.type) {
        case "header":
          return { type: "header", data: { text: block.data.text, level: block.data.level } };
        case "paragraph":
          return { type: "paragraph", data: { text: block.data.text } };
        case "list":
          return { type: "list", data: block.data as unknown as Record<string, unknown> };
        case "quote":
          return { type: "quote", data: { text: block.data.text, caption: block.data.caption, alignment: "left" } };
        case "alert":
          return {
            type: "alert",
            data: { type: block.data.type, align: block.data.align, message: block.data.text },
          };
        case "image": {
          const url = await safeUrl(block.data.file.key);
          return { type: "image", data: { file: { url, key: block.data.file.key }, caption: block.data.caption } };
        }
        case "table":
          return {
            type: "table",
            data: {
              withHeadings: block.data.withHeadings,
              stretched: false,
              content: block.data.content,
            },
          };
        case "attaches": {
          const url = await safeUrl(block.data.file.key);
          return {
            type: "attaches",
            data: {
              file: {
                url,
                key: block.data.file.key,
                name: block.data.file.name,
                extension: block.data.file.ext,
                size: block.data.file.size,
              },
              title: block.data.title,
            },
          };
        }
        default:
          return block as unknown as RawBlock;
      }
    }),
  );
}
