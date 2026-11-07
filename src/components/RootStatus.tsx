// The tree in hand against the root on-chain, the second read directly from the
// contract. They differ whenever an issuer has added members without publishing,
// and until they match every proof from this tree would be rejected.

const short = (root: string) => `${root.slice(0, 16)}…`;

export function RootStatus({
  localRoot,
  chainRoot,
}: {
  localRoot: string | null;
  chainRoot: string | null;
}) {
  const inSync = localRoot !== null && localRoot === chainRoot;
  return (
    <div className="stack tight">
      <div className="mono small">tree root: {localRoot ? short(localRoot) : "empty tree"}</div>
      <div className="mono small">on-chain: {chainRoot ? short(chainRoot) : "none published"}</div>
      {localRoot === null ? null : inSync ? (
        <div className="result ok small">This tree matches the root on-chain.</div>
      ) : (
        <div className="result no small" role="status">
          This tree does not match the root on-chain, so a proof from it would be rejected. The
          issuer needs to publish this tree's root, or this copy of the tree is out of date.
        </div>
      )}
    </div>
  );
}
