import { describe, expect, it } from "vitest";
import { formatInventoryBytes, inventoryValue } from "./inventory";

describe("inventoryValue", () => {
  it("reads decimal strings above Number.MAX_SAFE_INTEGER exactly", () => {
    const snapshot = { usage: { "7": { blobCount: "9007199254740993" } } };
    expect(inventoryValue(snapshot, 7, "blobCount")).toBe(9007199254740993n);
  });

  it("accepts safe integers but rejects rounded JSON numbers", () => {
    expect(inventoryValue({ usage: { "1": { totalBytes: 42 } } }, "1", "totalBytes")).toBe(42n);
    expect(inventoryValue({ usage: { "1": { totalBytes: 1.5 } } }, "1", "totalBytes")).toBeNull();
  });

  it("reports missing or negative counters as unknown", () => {
    expect(inventoryValue(undefined, 1, "blobCount")).toBeNull();
    expect(inventoryValue({ usage: {} }, 1, "blobCount")).toBeNull();
    expect(inventoryValue({ usage: { "1": { blobCount: "-1" } } }, "1", "blobCount")).toBeNull();
  });
});

describe("formatInventoryBytes", () => {
  it("formats byte counts with binary units", () => {
    expect(formatInventoryBytes(0n, "en-US")).toBe("0 B");
    expect(formatInventoryBytes(1023n, "en-US")).toBe("1,023 B");
    expect(formatInventoryBytes(1024n, "en-US")).toBe("1 KiB");
    expect(formatInventoryBytes(1536n, "en-US")).toBe("1.5 KiB");
    expect(formatInventoryBytes(1024n * 1024n * 3n, "en-US")).toBe("3 MiB");
  });

  it("rounds above Long.MAX_VALUE without losing precision", () => {
    expect(formatInventoryBytes(9_007_199_254_740_993n, "en-US")).toBe("8 PiB");
  });
});
