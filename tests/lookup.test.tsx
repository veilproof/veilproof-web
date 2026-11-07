import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LookupPage } from "../src/pages/LookupPage";
import type { ChainReader } from "../src/chain/reads";

function reader(isVerified: boolean, openRegistration = false): ChainReader {
  return {
    isVerified: async () => isVerified,
    currentRoot: async () => null,
    issuerOf: async () => "GISSUER",
    openRegistration: async () => openRegistration,
  };
}

async function lookup(chain: ChainReader, address: string) {
  render(<LookupPage reader={chain} />);
  await userEvent.type(screen.getByLabelText(/address/i), address);
  await userEvent.type(screen.getByLabelText(/credential/i), "kyc");
  await userEvent.click(screen.getByRole("button", { name: /check on-chain/i }));
}

describe("LookupPage", () => {
  it("shows a verified result read from chain, with its issuer", async () => {
    await lookup(reader(true), "GABC");
    expect(await screen.findByText("✓ Verified")).toBeInTheDocument();
    expect(screen.getByText(/read from the contract/i)).toBeInTheDocument();
    expect(screen.getByText("GISSUER")).toBeInTheDocument();
  });

  it("shows a not-verified result", async () => {
    await lookup(reader(false), "GXYZ");
    expect(await screen.findByText("Not verified")).toBeInTheDocument();
  });

  it("says what verified means on an open registry", async () => {
    await lookup(reader(true, true), "GABC");
    expect(await screen.findByText(/anyone can claim a credential name/)).toBeInTheDocument();
  });

  it("does not add that caveat on a curated registry", async () => {
    await lookup(reader(true, false), "GABC");
    await screen.findByText("✓ Verified");
    expect(screen.queryByText(/anyone can claim/)).toBeNull();
  });
});
