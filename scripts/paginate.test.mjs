import { describe, it, expect } from "vitest";
import { fetchAllRows } from "./paginate.mjs";

describe("fetchAllRows", () => {
  it("handles total 0 with a single empty page", async () => {
    const fetchPage = async (offset, limit) => ({ rows: [], total: 0 });
    const result = await fetchAllRows(fetchPage, 1000);
    expect(result).toEqual([]);
  });

  it("handles total 12 with a single page (pageSize 1000)", async () => {
    const data = Array.from({ length: 12 }, (_, i) => ({ id: i + 1 }));
    const fetchPage = async (offset, limit) => ({
      rows: data.slice(offset, offset + limit),
      total: 12,
    });
    const result = await fetchAllRows(fetchPage, 1000);
    expect(result).toEqual(data);
    expect(result.length).toBe(12);
  });

  it("handles total 2500 with pageSize 1000 (3 pages, checks offsets and no duplicates)", async () => {
    const data = Array.from({ length: 2500 }, (_, i) => ({ id: i + 1 }));
    const offsets = [];
    const fetchPage = async (offset, limit) => {
      offsets.push(offset);
      return {
        rows: data.slice(offset, offset + limit),
        total: 2500,
      };
    };
    const result = await fetchAllRows(fetchPage, 1000);
    expect(result).toEqual(data);
    expect(result.length).toBe(2500);
    expect(offsets).toEqual([0, 1000, 2000]);
    // Check no duplicates
    const ids = result.map((r) => r.id);
    expect(new Set(ids).size).toBe(2500);
  });

  it("handles server capping pages at 300 while pageSize is 1000 (total 2500)", async () => {
    const data = Array.from({ length: 2500 }, (_, i) => ({ id: i + 1 }));
    const fetchPage = async (offset, limit) => {
      const actualLimit = Math.min(limit, 300); // Server caps at 300
      return {
        rows: data.slice(offset, offset + actualLimit),
        total: 2500,
      };
    };
    const result = await fetchAllRows(fetchPage, 1000);
    expect(result).toEqual(data);
    expect(result.length).toBe(2500);
  });

  it("throws if a page is empty before reaching total", async () => {
    const fetchPage = async (offset, limit) => {
      if (offset === 0) {
        return { rows: Array.from({ length: 1000 }, (_, i) => ({ id: i + 1 })), total: 2500 };
      }
      // Second call returns empty page prematurely
      return { rows: [], total: 2500 };
    };
    await expect(fetchAllRows(fetchPage, 1000)).rejects.toThrow(
      "Received empty page at offset 1000 before reaching total of 2500 rows"
    );
  });

  it("throws if final count doesn't match reported total (over-delivered)", async () => {
    const fetchPage = async (offset, limit) => {
      if (offset === 0) {
        return { rows: Array.from({ length: 1000 }, (_, i) => ({ id: i + 1 })), total: 1500 };
      }
      // Over-deliver on second page
      return {
        rows: Array.from({ length: 1000 }, (_, i) => ({ id: 1000 + i + 1 })),
        total: 1500,
      };
    };
    await expect(fetchAllRows(fetchPage, 1000)).rejects.toThrow(
      "Fetched 2000 rows but server reports total of 1500"
    );
  });

  it("throws if final count doesn't match reported total (under-delivered)", async () => {
    const data = Array.from({ length: 1500 }, (_, i) => ({ id: i + 1 }));
    const fetchPage = async (offset, limit) => {
      return {
        rows: data.slice(offset, offset + limit),
        total: 2500, // Claims 2500 but only has 1500
      };
    };
    await expect(fetchAllRows(fetchPage, 1000)).rejects.toThrow(
      "Received empty page at offset 1500 before reaching total of 2500 rows"
    );
  });

  it("tracks offsets correctly (confirms 2500 case offsets are [0, 1000, 2000])", async () => {
    const data = Array.from({ length: 2500 }, (_, i) => i);
    const receivedOffsets = [];
    const fetchPage = async (offset, limit) => {
      receivedOffsets.push(offset);
      return {
        rows: data.slice(offset, offset + limit),
        total: 2500,
      };
    };
    await fetchAllRows(fetchPage, 1000);
    expect(receivedOffsets).toEqual([0, 1000, 2000]);
  });
});
