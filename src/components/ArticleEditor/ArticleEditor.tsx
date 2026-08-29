import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
// eslint-disable-next-line import/no-named-as-default
import EditorJS, { type OutputData, type ToolConstructable } from "@editorjs/editorjs";
import Header from "@editorjs/header";
import List from "@editorjs/list";
import Quote from "@editorjs/quote";
import TableTool from "@editorjs/table";
import ImageTool from "@editorjs/image";
import AttachesTool from "@editorjs/attaches";
import AlertTool from "editorjs-alert";
import InternalLinkInlineTool from "./internalLinkInlineTool";
import { addMaterialAttachment, getMaterialAttachmentUrl } from "../../data/repository";
import { toEditorBlocks, toStorageOutputData } from "../../data/editorBlocks";
import { openMaterialLinkPicker, wrapRangeWithMaterialLink } from "./materialLinkPicker";
import type { MaterialLinkPickerHandle } from "./materialLinkPicker";
import { ulid } from "../../data/ulid";
import { createObjectUrlTracker } from "../../data/objectUrlTracker";
import type { ObjectUrlTracker } from "../../data/objectUrlTracker";
import type { EditorJsOutputData } from "../../data/types";
import Icon from "../icons/Icon";
import type { IconName } from "../icons/Icon";
import { EDITOR_I18N } from "./editorI18n";
import "./ArticleEditor.css";
import { showToast } from "../../data/toastBus";

interface UploadFileResult {
  key: string;
  url: string;
  name: string;
  extension: string;
  size: number;
}

async function uploadAttachment(
  materialId: string,
  file: File,
  keyPrefix: string,
  tracker: ObjectUrlTracker,
): Promise<UploadFileResult> {
  const key = `${keyPrefix}-${ulid().slice(-10).toLowerCase()}`;
  await addMaterialAttachment(materialId, key, file.type || "application/octet-stream", file);
  const url = tracker.track(await getMaterialAttachmentUrl(materialId, key));
  const dotIndex = file.name.lastIndexOf(".");
  const extension = dotIndex >= 0 ? file.name.slice(dotIndex + 1) : "";
  return { key, url, name: file.name, extension, size: file.size };
}

export interface ArticleEditorProps {
  materialId: string;
  initialData: EditorJsOutputData;
  onReadyChange?: (ready: boolean) => void;
  onDirty?: () => void;
}

export interface ArticleEditorHandle {
  save: () => Promise<EditorJsOutputData>;
}

const ArticleEditor = forwardRef<ArticleEditorHandle, ArticleEditorProps>(function ArticleEditor(
  { materialId, initialData, onReadyChange, onDirty }: ArticleEditorProps,
  ref,
) {
  const holderRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorJS | null>(null);
  const readyPromiseRef = useRef<Promise<void>>(Promise.resolve());
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const linkPickerRef = useRef<MaterialLinkPickerHandle | null>(null);
  const urlTrackerRef = useRef(createObjectUrlTracker());

  useEffect(() => {
    let cancelled = false;
    let editor: EditorJS | null = null;
    const tracker = urlTrackerRef.current;

    async function init() {
      const rawBlocks = await toEditorBlocks(initialData.blocks, async (key) =>
        tracker.track(await getMaterialAttachmentUrl(materialId, key)),
      );
      if (cancelled || !holderRef.current) return;

      editor = new EditorJS({
        holder: holderRef.current,
        data: { time: initialData.time, blocks: rawBlocks as OutputData["blocks"], version: initialData.version },
        placeholder: "Start typing the article text…",
        i18n: EDITOR_I18N,
        onChange: () => onDirty?.(),
        tools: {
          header: { class: Header, inlineToolbar: true },
          list: { class: List, inlineToolbar: true },
          quote: { class: Quote, inlineToolbar: true },
          //
          table: { class: TableTool as unknown as ToolConstructable, inlineToolbar: true },
          internalLink: { class: InternalLinkInlineTool },
          alert: {
            class: AlertTool,
            inlineToolbar: true,
            config: { alertTypes: ["warning", "danger"], defaultType: "warning" },
          },
          image: {
            class: ImageTool,
            config: {
              uploader: {
                async uploadByFile(file: File) {
                  const uploaded = await uploadAttachment(materialId, file, "img", tracker);
                  return { success: 1, file: uploaded };
                },
              },
            },
          },
          attaches: {
            class: AttachesTool,
            config: {
              uploader: {
                async uploadByFile(file: File) {
                  const uploaded = await uploadAttachment(materialId, file, "file", tracker);
                  return { success: 1, file: uploaded };
                },
              },
            },
          },
        },
      });

      editorRef.current = editor;
      readyPromiseRef.current = editor.isReady.then(() => {
        onReadyChange?.(true);
        setReady(true);
      });
    }

    init().catch((err) => {
      if (cancelled) return;
      console.error("Article editor failed to open", err);
      setInitError(err instanceof Error ? err.message : String(err));
    });

    return () => {
      cancelled = true;
      onReadyChange?.(false);
      setReady(false);
      const toDestroy = editorRef.current;
      editorRef.current = null;
      if (toDestroy) {
        toDestroy.isReady.then(() => toDestroy.destroy()).catch(() => undefined);
      }
      tracker.revokeAll();
      linkPickerRef.current?.close();
      linkPickerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId]);

  useImperativeHandle(ref, () => ({
    async save() {
      await readyPromiseRef.current;
      if (!editorRef.current) throw new Error("Editor is not ready yet");
      const output = await editorRef.current.save();
      return toStorageOutputData(output as unknown as { time: number; blocks: { type: string; data: Record<string, unknown> }[]; version: string });
    },
  }));

  function applyInline(command: "bold" | "italic") {
    document.execCommand(command);
  }

  //
  //
  function openLinkPicker() {
    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    if (!range || !holderRef.current?.contains(range.commonAncestorContainer)) {
      showToast({
        message: "Place the cursor in the article text — the link will be inserted there.",
        role: "neutral",
      });
      return;
    }

    const savedRange = range.cloneRange();
    linkPickerRef.current?.close();
    linkPickerRef.current = openMaterialLinkPicker({
      anchorRect: range.getBoundingClientRect(),
      onPick: (material) => {
        linkPickerRef.current = null;
        wrapRangeWithMaterialLink(savedRange, material);
        onDirty?.();
      },
      onCancel: () => {
        linkPickerRef.current = null;
      },
    });
  }

  // 2.8.9, @editorjs/list 2.0.9, @editorjs/quote 2.7.6, editorjs-alert 1.1.4)
  function insertBlock(type: string, data: Record<string, unknown>) {
    const editor = editorRef.current;
    if (!editor) return;
    const currentIndex = editor.blocks.getCurrentBlockIndex();
    const index = currentIndex >= 0 ? currentIndex + 1 : editor.blocks.getBlocksCount();
    editor.blocks.insert(type, data, undefined, index, true);
  }

  interface StickyButtonSpec {
    key: string;
    icon: IconName;
    label: string;
    onClick: () => void;
  }

  const stickyButtons: StickyButtonSpec[] = [
    { key: "bold", icon: "bold", label: "Bold", onClick: () => applyInline("bold") },
    { key: "italic", icon: "italic", label: "Italic", onClick: () => applyInline("italic") },
    { key: "link", icon: "link", label: "Link", onClick: openLinkPicker },
    { key: "header", icon: "heading", label: "Heading", onClick: () => insertBlock("header", { text: "", level: 2 }) },
    { key: "list", icon: "list", label: "List", onClick: () => insertBlock("list", { style: "unordered", meta: {}, items: [] }) },
    { key: "quote", icon: "quote", label: "Quote", onClick: () => insertBlock("quote", { text: "", caption: "", alignment: "left" }) },
    {
      key: "table",
      icon: "table",
      label: "Table",
      onClick: () =>
        insertBlock("table", {
          withHeadings: true,
          stretched: false,
          content: [
            ["", ""],
            ["", ""],
          ],
        }),
    },
    {
      key: "warning",
      icon: "warning",
      label: "Warning",
      onClick: () => insertBlock("alert", { type: "warning", align: "left", message: "" }),
    },
  ];

  return (
    <div className="article-editor-wrapper" data-help="editor-body">
      <div className="article-editor__sticky-toolbar surface-glass-blur" role="toolbar" aria-label="Formatting">
        {stickyButtons.map((button) => (
          <button
            key={button.key}
            type="button"
            className="article-editor__sticky-button"
            title={button.label}
            aria-label={button.label}
            disabled={!ready}
            onMouseDown={(e) => e.preventDefault()}
            onClick={button.onClick}
          >
            <Icon name={button.icon} size={16} />
          </button>
        ))}
      </div>
      {initError && (
        <p className="article-editor__init-error" role="alert">
          Could not open the article for editing. The article text is intact — it can still be read,
          just not edited for now. Show this line to a developer: {initError}
        </p>
      )}
      <div className="article-editor" ref={holderRef} />
    </div>
  );
});

export default ArticleEditor;
