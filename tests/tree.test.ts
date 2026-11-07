import { beforeEach, describe, expect, it } from "vitest";
import {
  addLeaf,
  loadTree,
  parseTree,
  saveTree,
  serializeTree,
  TREE_CAPACITY,
  type TreeFile,
} from "../src/tree/treeFile";

const leaf = (n: number) => n.toString(16).padStart(64, "0");
const tree = (leaves: string[] = []): TreeFile => ({
  version: 1,
  contractId: "CABC",
  credential: "kyc",
  leaves,
});

describe("tree files", () => {
  it("round-trips", () => {
    const original = tree([leaf(1), leaf(2)]);
    expect(parseTree(serializeTree(original))).toEqual(original);
  });

  it.each([
    ["not json", "not json", /valid JSON/],
    ["a null", "null", /version 1/],
    ["another version", JSON.stringify({ ...tree(), version: 2 }), /version 1/],
    ["no credential", JSON.stringify({ version: 1, leaves: [] }), /registry and credential/],
    ["a bad leaf", JSON.stringify(tree(["xyz"])), /64 lowercase hex/],
    ["uppercase hex", JSON.stringify(tree(["A".repeat(64)])), /64 lowercase hex/],
    [
      "too many leaves",
      JSON.stringify(tree(Array.from({ length: TREE_CAPACITY + 1 }, (_, i) => leaf(i)))),
      /more than the 16/,
    ],
  ])("rejects %s", (_name, text, message) => {
    expect(() => parseTree(text)).toThrow(message);
  });

  it("carries no field beyond what a holder needs", () => {
    const parsed = parseTree(JSON.stringify({ ...tree(), secret: "should not survive" }));
    expect(parsed).not.toHaveProperty("secret");
  });
});

describe("addLeaf", () => {
  it("normalizes and appends without mutating", () => {
    const start = tree();
    const next = addLeaf(start, `  ${"AB".repeat(32)} `);
    expect(next.leaves).toEqual(["ab".repeat(32)]);
    expect(start.leaves).toEqual([]);
  });

  it("keeps insertion order, which the root depends on", () => {
    const next = addLeaf(addLeaf(tree(), leaf(2)), leaf(1));
    expect(next.leaves).toEqual([leaf(2), leaf(1)]);
  });

  it("refuses a malformed commitment, a duplicate, and a full tree", () => {
    expect(() => addLeaf(tree(), "abc")).toThrow(/64 hex/);
    expect(() => addLeaf(tree([leaf(1)]), leaf(1))).toThrow(/already in the tree/);
    const full = tree(Array.from({ length: TREE_CAPACITY }, (_, i) => leaf(i)));
    expect(() => addLeaf(full, leaf(99))).toThrow(/full/);
  });
});

describe("the copy in this browser", () => {
  beforeEach(() => localStorage.clear());

  it("restores a saved tree, per registry and credential", () => {
    saveTree(tree([leaf(1)]));
    expect(loadTree("CABC", "kyc").leaves).toEqual([leaf(1)]);
    expect(loadTree("CABC", "aml").leaves).toEqual([]);
    expect(loadTree("CXYZ", "kyc").leaves).toEqual([]);
  });

  it("treats corrupt saved data as empty rather than failing", () => {
    localStorage.setItem("veilproof:tree:CABC:kyc", "garbage");
    expect(loadTree("CABC", "kyc").leaves).toEqual([]);
  });
});
