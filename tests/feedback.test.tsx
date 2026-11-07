import { describe, it, expect, vi } from "vitest";
import { Networks } from "@stellar/stellar-sdk";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describeError } from "../src/chain/errors";
import { contractUrl, networkMismatch, networkName, txUrl } from "../src/chain/network";
import { TxLink } from "../src/components/TxLink";

const HASH = "d38953ec3a3f9447ad9edf2f06983c07855f2b63b4e6c2dca20adb15a291497d";

describe("describeError", () => {
  // The shape the SDK throws from prepareTransaction when simulation fails.
  const simulationFailure = (code: number) =>
    new Error(
      `host invocation failed\n\nCaused by:\n    HostError: Error(Contract, #${code})\n    \n    Event log (newest first):\n       0: [Diagnostic Event] topics:[error, Error(Contract, #${code})]`,
    );

  it("tells a holder a replay means they may already be verified", () => {
    const text = describeError(simulationFailure(8));
    expect(text).toMatch(/already been used/);
    expect(text).toContain("#8");
  });

  it("tells a holder a failed proof is usually a stale root", () => {
    const text = describeError(simulationFailure(7));
    expect(text).toMatch(/regenerate/);
    expect(text).toContain("#7");
  });

  it("falls back to the raw message for a code it has no text for", () => {
    const error = simulationFailure(2);
    expect(describeError(error)).toBe(error.message);
  });

  it("explains an unfunded account", () => {
    expect(describeError(new Error("Account not found: GABC"))).toMatch(/Get test XLM/);
  });

  it("leaves anything else alone", () => {
    expect(describeError(new Error("the user declined"))).toBe("the user declined");
    expect(describeError("plain string")).toBe("plain string");
  });
});

describe("networks", () => {
  it("links to the explorer for the configured network, not always testnet", () => {
    expect(txUrl(Networks.TESTNET, HASH)).toBe(
      `https://stellar.expert/explorer/testnet/tx/${HASH}`,
    );
    expect(txUrl(Networks.PUBLIC, HASH)).toBe(`https://stellar.expert/explorer/public/tx/${HASH}`);
    expect(contractUrl(Networks.TESTNET, "CABC")).toBe(
      "https://stellar.expert/explorer/testnet/contract/CABC",
    );
  });

  it("gives no link for a network without an explorer", () => {
    expect(txUrl(Networks.FUTURENET, HASH)).toBeNull();
    expect(txUrl("Some private network", HASH)).toBeNull();
  });

  it("is quiet when the wallet and app agree", () => {
    expect(networkMismatch(Networks.TESTNET, Networks.TESTNET)).toBeNull();
  });

  it("names both sides when they differ", () => {
    const message = networkMismatch(Networks.TESTNET, Networks.PUBLIC);
    expect(message).toContain("This app is on Testnet");
    expect(message).toContain("your wallet is on Mainnet");
  });

  it("does not hide an unknown network behind a generic name", () => {
    expect(networkName("My Standalone Network")).toContain("My Standalone Network");
  });
});

describe("TxLink", () => {
  it("links to the transaction on the right network", () => {
    render(<TxLink hash={HASH} networkPassphrase={Networks.TESTNET} />);
    expect(screen.getByRole("link", { name: /stellar expert/i })).toHaveAttribute(
      "href",
      `https://stellar.expert/explorer/testnet/tx/${HASH}`,
    );
  });

  it("copies the hash in one action and says so", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<TxLink hash={HASH} networkPassphrase={Networks.TESTNET} />);

    await user.click(screen.getByRole("button", { name: /copy hash/i }));

    expect(writeText).toHaveBeenCalledWith(HASH);
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });
});
