import { describe, expect, it, vi } from "vitest";
import { toEditorBlocks, toStorageBlocks, toStorageOutputData } from "./editorBlocks";
import type { EditorJsBlock } from "./types";

const RAW_TIME = 1700000000000;
const RAW_VERSION = "2.31.6";

function rawOf(blocks: Array<{ type: string; data: Record<string, unknown> }>) {
  return { time: RAW_TIME, blocks, version: RAW_VERSION };
}

const canonical: Record<EditorJsBlock["type"], EditorJsBlock> = {
  header: { type: "header", data: { text: "Article heading", level: 1 } },
  paragraph: { type: "paragraph", data: { text: "A regular paragraph of text." } },
  list: {
    type: "list",
    data: {
      style: "ordered",
      meta: { counterType: "numeric", start: 1 },
      items: [
        { content: "Item 1", meta: {}, items: [] },
        {
          content: "Item 2",
          meta: {},
          items: [
            { content: "Subitem 2.1", meta: {}, items: [] },
            { content: "Subitem 2.2", meta: {}, items: [{ content: "Subsubitem 2.2.1", meta: {}, items: [] }] },
          ],
        },
      ],
    },
  },
  quote: { type: "quote", data: { text: "The quote in full.", caption: "Quote author" } },
  alert: { type: "alert", data: { type: "warning", align: "left", text: "Important: do not forget." } },
  image: { type: "image", data: { file: { key: "img-abc123" }, caption: "Caption under the picture" } },
  attaches: {
    type: "attaches",
    data: { file: { key: "file-abc123", name: "Notes.docx", ext: "docx", size: 15400 }, title: "Notes form" },
  },
  table: {
    type: "table",
    data: {
      withHeadings: true,
      content: [
        ["Time", "Planned tasks"],
        ["07:00-08:00", ""],
      ],
    },
  },
};

async function roundTripThroughEditor(block: EditorJsBlock): Promise<EditorJsBlock[]> {
  const rawBlocks = await toEditorBlocks([block], async (key) => `resolved://${key}`);
  return toStorageBlocks(rawOf(rawBlocks));
}

describe("editorBlocks: round-trip toStorage(toEditor(x)) === x (canon for every block type)", () => {
  it.each(Object.values(canonical))("$type: the canon survives display in the editor and saving back", async (block) => {
    const result = await roundTripThroughEditor(block);
    expect(result).toEqual([block]);
  });
});

describe("editorBlocks: toEditor(toStorage(y)) restores the fields plugins need", () => {
  it("alert: canon text -> message in the editorjs-alert plugin data", async () => {
    const raw = rawOf([{ type: "alert", data: { type: "danger", align: "center", message: "Careful, danger!" } }]);
    const canon = toStorageBlocks(raw);
    expect(canon).toEqual([{ type: "alert", data: { type: "danger", align: "center", text: "Careful, danger!" } }]);

    const backToEditor = await toEditorBlocks(canon, async (key) => `resolved://${key}`);
    expect(backToEditor[0].data.message).toBe("Careful, danger!");
    expect(backToEditor[0].data.type).toBe("danger");
    expect(backToEditor[0].data.align).toBe("center");
  });

  it("image: url is resolved through resolveAttachmentUrl from _attachments by key", async () => {
    const raw = rawOf([{ type: "image", data: { file: { key: "img-xyz" }, caption: "Cat" } }]);
    const canon = toStorageBlocks(raw);
    expect(canon).toEqual([{ type: "image", data: { file: { key: "img-xyz" }, caption: "Cat" } }]);

    const resolveAttachmentUrl = vi.fn(async (key: string) => `blob:resolved/${key}`);
    const backToEditor = await toEditorBlocks(canon, resolveAttachmentUrl);
    expect(resolveAttachmentUrl).toHaveBeenCalledWith("img-xyz");
    const fileData = backToEditor[0].data.file as { key: string; url: string };
    expect(fileData.url).toBe("blob:resolved/img-xyz");
    expect(fileData.key).toBe("img-xyz");
  });

  it("attaches: url is resolved, extension is restored from the canonical ext", async () => {
    const raw = rawOf([
      {
        type: "attaches",
        data: { file: { key: "file-xyz", name: "Manual.pdf", extension: "pdf", size: 9000 }, title: "Manual" },
      },
    ]);
    const canon = toStorageBlocks(raw);
    expect(canon).toEqual([
      { type: "attaches", data: { file: { key: "file-xyz", name: "Manual.pdf", ext: "pdf", size: 9000 }, title: "Manual" } },
    ]);

    const resolveAttachmentUrl = vi.fn(async (key: string) => `blob:resolved/${key}`);
    const backToEditor = await toEditorBlocks(canon, resolveAttachmentUrl);
    expect(resolveAttachmentUrl).toHaveBeenCalledWith("file-xyz");
    const fileData = backToEditor[0].data.file as { key: string; url: string; extension: string; name: string; size: number };
    expect(fileData.url).toBe("blob:resolved/file-xyz");
    expect(fileData.extension).toBe("pdf");
    expect(fileData.name).toBe("Manual.pdf");
    expect(fileData.size).toBe(9000);
  });
});

describe("editorBlocks: the shape the uploader from ArticleEditor.tsx actually returns", () => {

  it("image: uploader shape - key makes it to the canon, url and tunes are dropped", () => {
    const raw = rawOf([
      {
        type: "image",
        data: {
          file: { key: "img-uploaded-1", url: "blob:http://localhost/abc", name: "photo.png", extension: "png", size: 40960 },
          caption: "",
          withBorder: false,
          withBackground: false,
          stretched: false,
        },
      },
    ]);
    const canon = toStorageBlocks(raw);
    expect(canon).toEqual([{ type: "image", data: { file: { key: "img-uploaded-1" }, caption: "" } }]);
  });

  it("attaches: uploader shape ({ success: 1, file: {...} } unpacked by the tool into data.file) - key makes it, url dropped", () => {
    const uploaderResponse = {
      success: 1,
      file: { key: "file-uploaded-1", url: "blob:http://localhost/def", name: "Onboarding notes.docx", extension: "docx", size: 15400 },
    };
    const raw = rawOf([{ type: "attaches", data: { file: uploaderResponse.file, title: "" } }]);
    const canon = toStorageBlocks(raw);
    expect(canon).toEqual([
      {
        type: "attaches",
        data: { file: { key: "file-uploaded-1", name: "Onboarding notes.docx", ext: "docx", size: 15400 }, title: "" },
      },
    ]);
  });
});

describe("editorBlocks: toStorageOutputData wraps toStorageBlocks preserving time/version", () => {
  it("time and version carry over unchanged, blocks are canonical", () => {
    const raw = rawOf([{ type: "paragraph", data: { text: "Text" } }]);
    const result = toStorageOutputData(raw);
    expect(result.time).toBe(RAW_TIME);
    expect(result.version).toBe(RAW_VERSION);
    expect(result.blocks).toEqual([{ type: "paragraph", data: { text: "Text" } }]);
  });
});

describe("editorBlocks: a missing attachment does not take down the whole article", () => {
  const brokenResolver = async (key: string) => {
    if (key === "file-1") throw new Error(`missing attachment: ${key}`);
    return `resolved://${key}`;
  };

  it("attaches with a nonexistent attachment: blocks are returned, not rejected", async () => {
    const canon: EditorJsBlock[] = [
      { type: "paragraph", data: { text: "When the draft is about to be published" } },
      {
        type: "attaches",
        data: { file: { key: "file-1", name: "Klient.docx", ext: "docx", size: 0 }, title: "Klient.docx" },
      },
    ];

    const raw = await toEditorBlocks(canon, brokenResolver);

    expect(raw).toHaveLength(2);
    expect(raw[0]).toEqual({ type: "paragraph", data: { text: "When the draft is about to be published" } });
    expect((raw[1].data.file as Record<string, unknown>).url).toBe("");
  });

  it("the attachment key survives the miss: saving will not erase the reference", async () => {
    const canon: EditorJsBlock[] = [
      {
        type: "attaches",
        data: { file: { key: "file-1", name: "Klient.docx", ext: "docx", size: 0 }, title: "Klient.docx" },
      },
    ];

    const raw = await toEditorBlocks(canon, brokenResolver);
    const backToStorage = toStorageBlocks(rawOf(raw));

    expect(backToStorage).toEqual(canon);
  });

  it("one broken attachment does not spoil the intact one next to it", async () => {
    const canon: EditorJsBlock[] = [
      { type: "image", data: { file: { key: "file-1" }, caption: "Broken" } },
      { type: "image", data: { file: { key: "img-2" }, caption: "Intact" } },
    ];

    const raw = await toEditorBlocks(canon, brokenResolver);

    expect((raw[0].data.file as Record<string, unknown>).url).toBe("");
    expect((raw[1].data.file as Record<string, unknown>).url).toBe("resolved://img-2");
  });
});
