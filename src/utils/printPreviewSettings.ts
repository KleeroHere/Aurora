
const STORAGE_KEY = "aurora.printPreview.skip";

export function shouldSkipPrintPreview(): boolean {
  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

export function setSkipPrintPreview(next: boolean): void {
  window.localStorage.setItem(STORAGE_KEY, String(next));
}
