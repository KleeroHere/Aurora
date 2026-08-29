import type { API, InlineTool, InlineToolConstructorOptions } from "@editorjs/editorjs";
import { isInternalMaterialLink } from "../../data/internalLinks";
import type { MaterialSummary } from "../../data/types";
import { openMaterialLinkPicker, wrapRangeWithMaterialLink } from "./materialLinkPicker";
import type { MaterialLinkPickerHandle } from "./materialLinkPicker";

const LINK_ICON =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M8.5 5.5 12 2M12 2H8.5M12 2v3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M9.5 8.5v2A1.5 1.5 0 0 1 8 12H3.5A1.5 1.5 0 0 1 2 10.5V6A1.5 1.5 0 0 1 3.5 4.5h2" ' +
  'stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
  "</svg>";

export default class InternalLinkInlineTool implements InlineTool {
  static get isInline() {
    return true;
  }

  static get title() {
    return "Link to material";
  }

  static get sanitize() {
    return { a: { href: true } };
  }

  private readonly api: API;
  private button: HTMLButtonElement | null = null;
  private state = false;
  private savedRange: Range | null = null;
  private picker: MaterialLinkPickerHandle | null = null;

  constructor({ api }: InlineToolConstructorOptions) {
    this.api = api;
  }

  render(): HTMLElement {
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.classList.add(this.api.styles.inlineToolButton);
    this.button.innerHTML = LINK_ICON;
    this.button.title = InternalLinkInlineTool.title;
    return this.button;
  }

  surround(range: Range | null): void {
    if (!range) return;

    if (this.state) {
      this.unwrap();
      return;
    }

    this.savedRange = range.cloneRange();
    this.picker?.close();
    this.picker = openMaterialLinkPicker({
      anchorRect: range.getBoundingClientRect(),
      onPick: (material) => this.applyLink(material),
      onCancel: () => {
        this.picker = null;
      },
    });
  }

  checkState(): boolean {
    const anchor = this.api.selection.findParentTag("A");
    this.state = Boolean(anchor && isInternalMaterialLink(anchor.getAttribute("href")));
    if (this.button) {
      this.button.classList.toggle(this.api.styles.inlineToolButtonActive, this.state);
    }
    return this.state;
  }

  private unwrap(): void {
    const anchor = this.api.selection.findParentTag("A");
    if (!anchor) return;
    this.api.selection.expandToTag(anchor);
    anchor.replaceWith(...Array.from(anchor.childNodes));
  }

  private applyLink(material: MaterialSummary): void {
    const range = this.savedRange;
    this.picker = null;
    if (!range) return;
    wrapRangeWithMaterialLink(range, material);
  }
}
