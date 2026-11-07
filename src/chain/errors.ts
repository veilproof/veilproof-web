// Turn the failures a user can actually meet into something they can act on.
// Contract errors arrive inside SDK messages as `Error(Contract, #N)`; the codes
// are veilproof-registry's `Error` enum, which only ever gains new numbers.

const CONTRACT_ERRORS: Record<number, string> = {
  3: "The connected wallet is not this credential's issuer, or the issuer has been revoked.",
  4: "This credential name is already taken. Choose another one.",
  5: "No issuer has claimed this credential yet.",
  6: "The issuer has not published a root for this credential yet.",
  7: "The proof did not verify. Most often the issuer has published a new root since this proof was made: regenerate it from the current tree. A proof only works from the address it was generated for, so also check the connected wallet.",
  8: "This secret has already been used to verify for this credential, so it cannot verify again. If it was you, your address is already verified: check the Lookup tab.",
  12: "That circuit is not registered on this registry.",
  14: "Verification on this credential's circuit is paused by the registry's admin.",
  15: "This registry only accepts issuers its admin registers, so a credential cannot be claimed here.",
};

const CONTRACT_ERROR = /Error\(Contract, #(\d+)\)/;

/** Explain a failure, keeping the code. Anything unrecognised stays as it was. */
export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  const code = CONTRACT_ERROR.exec(message)?.[1];
  if (code) {
    const explanation = CONTRACT_ERRORS[Number(code)];
    if (explanation) return `${explanation} (contract error #${code})`;
    return message;
  }

  if (/account not found/i.test(message)) {
    return "This account does not exist on the network yet. It needs some XLM first: on testnet, use the Get test XLM button.";
  }
  return message;
}
