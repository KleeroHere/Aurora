import { describe, expect, it, vi } from "vitest";
import { createBrowserFilePort } from "./filePortBrowser";

describe("createBrowserFilePort", () => {
  it("pickSaveLocation returns a named handle immediately, without invoking the picker", async () => {
    const filePicker = vi.fn();
    const port = createBrowserFilePort(vi.fn(), filePicker);
    const handle = await port.pickSaveLocation("dump-2026-07-28.json", "title");
    expect(handle).toEqual({ kind: "browser-save", name: "dump-2026-07-28.json" });
    expect(filePicker).not.toHaveBeenCalled();
  });

  it("writeDump calls downloadTrigger with a blob of the right content and the name from the handle", async () => {
    const downloadTrigger = vi.fn();
    const port = createBrowserFilePort(downloadTrigger, vi.fn());
    const handle = await port.pickSaveLocation("dump.json", "title");
    const data = new TextEncoder().encode('{"a":1}');

    await port.writeDump(handle, data);

    expect(downloadTrigger).toHaveBeenCalledTimes(1);
    const [blob, filename] = downloadTrigger.mock.calls[0];
    expect(filename).toBe("dump.json");
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/json");
    const roundTrip = new Uint8Array(await blob.arrayBuffer());
    expect(roundTrip).toEqual(data);
  });

  it("writeDump uses the passed mimeType for the Blob instead of hardcoded application/json (P2.2)", async () => {
    const downloadTrigger = vi.fn();
    const port = createBrowserFilePort(downloadTrigger, vi.fn());
    const handle = await port.pickSaveLocation("Presentation.pdf", "title");
    const data = new TextEncoder().encode("%PDF-1.4");

    await port.writeDump(handle, data, "application/pdf");

    const [blob] = downloadTrigger.mock.calls[0];
    expect(blob.type).toBe("application/pdf");
  });

  it("writeDump throws when the handle is not from pickSaveLocation", async () => {
    const port = createBrowserFilePort(vi.fn(), vi.fn());
    await expect(port.writeDump({ kind: "something-else" }, new Uint8Array())).rejects.toThrow(
      /pickSaveLocation/,
    );
  });

  it("pickFile returns whatever the injected filePicker returned", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "dump.json", { type: "application/json" });
    const filePicker = vi.fn().mockResolvedValue(file);
    const port = createBrowserFilePort(vi.fn(), filePicker);

    const handle = await port.pickFile();

    expect(handle).toBe(file);
    expect(filePicker).toHaveBeenCalledTimes(1);
  });

  it("pickFile returns null when the picker cancels", async () => {
    const filePicker = vi.fn().mockResolvedValue(null);
    const port = createBrowserFilePort(vi.fn(), filePicker);

    expect(await port.pickFile()).toBeNull();
  });

  it("readDump reads the bytes of a File obtained from pickFile", async () => {
    const bytes = new Uint8Array([10, 20, 30, 40]);
    const file = new File([bytes], "dump.json", { type: "application/json" });
    const port = createBrowserFilePort(vi.fn(), vi.fn());

    const result = await port.readDump(file);

    expect(result).toEqual(bytes);
  });

  it("readDump throws when the handle is not a File", async () => {
    const port = createBrowserFilePort(vi.fn(), vi.fn());
    await expect(port.readDump({ not: "a file" })).rejects.toThrow(/pickFile/);
  });

  it("pickFiles returns whatever the injected filesPicker returned", async () => {
    const files = [
      new File([new Uint8Array([1])], "bundle.manifest.json"),
      new File([new Uint8Array([2])], "bundle.part001.json"),
    ];
    const filesPicker = vi.fn().mockResolvedValue(files);
    const port = createBrowserFilePort(vi.fn(), vi.fn(), filesPicker);

    const handles = await port.pickFiles();

    expect(handles).toBe(files);
    expect(filesPicker).toHaveBeenCalledTimes(1);
  });

  it("pickFiles returns null when the picker cancels", async () => {
    const filesPicker = vi.fn().mockResolvedValue(null);
    const port = createBrowserFilePort(vi.fn(), vi.fn(), filesPicker);

    expect(await port.pickFiles()).toBeNull();
  });
});
