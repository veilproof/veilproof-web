// A credential's tree is just its list of leaf commitments, in order. The issuer
// keeps it and hands it to holders as a small JSON file, and a holder computes
// their own Merkle witness from it. No service sits in between, so there is
// nothing that learns which leaf a holder is asking about.
//
// It holds commitments only: hashes, with no identities and no secrets. It does
// reveal how many members the set has to anyone who has the file.

/** Trees hold 2^4 members; the prover refuses more. See veilproof-server#20. */
export const TREE_CAPACITY = 16;

const LEAF = /^[0-9a-f]{64}$/;

export interface TreeFile {
  version: 1;
  contractId: string;
  credential: string;
  leaves: string[];
}

export function serializeTree(tree: TreeFile): string {
  return `${JSON.stringify(tree, null, 2)}\n`;
}

/** Parse a tree file someone handed over, rejecting anything malformed. */
export function parseTree(text: string): TreeFile {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("That is not a tree file: it isn't valid JSON.");
  }
  const tree = value as Partial<TreeFile> | null;
  if (tree?.version !== 1) throw new Error("That is not a version 1 tree file.");
  if (typeof tree.contractId !== "string" || typeof tree.credential !== "string") {
    throw new Error("That tree file does not say which registry and credential it is for.");
  }
  if (!Array.isArray(tree.leaves) || !tree.leaves.every((l) => LEAF.test(String(l)))) {
    throw new Error("That tree file has a leaf that isn't 64 lowercase hex characters.");
  }
  if (tree.leaves.length > TREE_CAPACITY) {
    throw new Error(`That tree has more than the ${TREE_CAPACITY} members a tree can hold.`);
  }
  return {
    version: 1,
    contractId: tree.contractId,
    credential: tree.credential,
    leaves: tree.leaves,
  };
}

const storageKey = (contractId: string, credential: string) =>
  `veilproof:tree:${contractId}:${credential}`;

/** The tree saved in this browser, or an empty one. */
export function loadTree(contractId: string, credential: string): TreeFile {
  const empty: TreeFile = { version: 1, contractId, credential, leaves: [] };
  try {
    const saved = localStorage.getItem(storageKey(contractId, credential));
    return saved ? parseTree(saved) : empty;
  } catch {
    return empty;
  }
}

/**
 * Keep the tree in this browser. A convenience only: the downloaded file is the
 * real copy, since clearing site data here would otherwise lose the leaves.
 */
export function saveTree(tree: TreeFile): void {
  try {
    localStorage.setItem(storageKey(tree.contractId, tree.credential), serializeTree(tree));
  } catch {
    // Private windows and full quotas can refuse. The tree stays in memory.
  }
}

/** Add a leaf, refusing a duplicate, a malformed value, or a full tree. */
export function addLeaf(tree: TreeFile, commitment: string): TreeFile {
  const leaf = commitment.trim().toLowerCase();
  if (!LEAF.test(leaf)) throw new Error("A commitment is 64 hex characters.");
  if (tree.leaves.includes(leaf)) throw new Error("That commitment is already in the tree.");
  if (tree.leaves.length >= TREE_CAPACITY) {
    throw new Error(`This tree is full: it holds ${TREE_CAPACITY} members.`);
  }
  return { ...tree, leaves: [...tree.leaves, leaf] };
}

export function downloadTree(tree: TreeFile): void {
  const blob = new Blob([serializeTree(tree)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${tree.credential}.tree.json`;
  link.click();
  URL.revokeObjectURL(url);
}
