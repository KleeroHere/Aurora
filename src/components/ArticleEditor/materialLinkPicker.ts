import { searchMaterials } from "../../data/repository";
import type { MaterialSummary } from "../../data/types";
import { buildInternalLinkHref } from "../../data/internalLinks";
import "./internalLinkPicker.css";

export interface MaterialLinkPickerHandle {
  close: () => void;
}

interface OpenOptions {
  anchorRect: DOMRect;
  onPick: (material: MaterialSummary) => void;
  onCancel?: () => void;
}

export function openMaterialLinkPicker({ anchorRect, onPick, onCancel }: OpenOptions): MaterialLinkPickerHandle {
  const popover = document.createElement("div");
  popover.className = "internal-link-picker";
  popover.style.top = `${window.scrollY + anchorRect.bottom + 6}px`;
  popover.style.left = `${window.scrollX + anchorRect.left}px`;

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Find a material…";
  input.className = "internal-link-picker__input";

  const list = document.createElement("ul");
  list.className = "internal-link-picker__results";

  popover.appendChild(input);
  popover.appendChild(list);
  document.body.appendChild(popover);

  let closed = false;
  let documentClickHandler: ((event: MouseEvent) => void) | null = null;
  let debounceId: ReturnType<typeof setTimeout> | null = null;

  function close(cancelled: boolean): void {
    if (closed) return;
    closed = true;
    if (debounceId) clearTimeout(debounceId);
    if (documentClickHandler) {
      document.removeEventListener("mousedown", documentClickHandler, true);
      documentClickHandler = null;
    }
    popover.remove();
    if (cancelled) onCancel?.();
  }

  async function runSearch(query: string): Promise<void> {
    const trimmed = query.trim();
    list.innerHTML = "";
    if (!trimmed) return;

    const hits = await searchMaterials(trimmed);
    if (closed || !document.body.contains(popover)) return;

    if (hits.length === 0) {
      const empty = document.createElement("li");
      empty.className = "internal-link-picker__empty";
      empty.textContent = "Nothing found";
      list.appendChild(empty);
      return;
    }

    for (const { summary } of hits.slice(0, 20)) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "internal-link-picker__result";
      button.textContent = summary.title;
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => {
        close(false);
        onPick(summary);
      });
      item.appendChild(button);
      list.appendChild(item);
    }
  }

  input.addEventListener("input", () => {
    if (debounceId) clearTimeout(debounceId);
    debounceId = setTimeout(() => void runSearch(input.value), 150);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close(true);
    }
  });

  documentClickHandler = (event: MouseEvent) => {
    if (popover.contains(event.target as Node)) return;
    close(true);
  };
  setTimeout(() => {
    if (!closed && documentClickHandler) {
      document.addEventListener("mousedown", documentClickHandler, true);
    }
  }, 0);

  input.focus();

  return { close: () => close(true) };
}

export function wrapRangeWithMaterialLink(range: Range, material: MaterialSummary): void {
  const anchor = document.createElement("a");
  anchor.setAttribute("href", buildInternalLinkHref(material._id));

  if (range.collapsed) {
    anchor.textContent = material.title;
    range.insertNode(anchor);
  } else {
    anchor.appendChild(range.extractContents());
    range.insertNode(anchor);
  }

  const selection = window.getSelection();
  range.setStartAfter(anchor);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);
}
