import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LookupPage } from "../src/pages/LookupPage";
import type { ChainReader } from "../src/chain/reads";

function reader(isVerified: boolean): ChainReader {
  return {
    isVerified: async () => isVerified,
    currentRoot: async () => null,
  };
}

describe("LookupPage", () => {
  it("shows a verified result read from chain", async () => {
    render(<LookupPage reader={reader(true)} />);
    await userEvent.type(screen.getByLabelText(/address/i), "GABC");
    await userEvent.type(screen.getByLabelText(/credential/i), "kyc");
    await userEvent.click(screen.getByRole("button", { name: /check on-chain/i }));
    expect(await screen.findByText("✓ Verified")).toBeInTheDocument();
    expect(screen.getByText(/read from the contract/i)).toBeInTheDocument();
  });

  it("shows a not-verified result", async () => {
    render(<LookupPage reader={reader(false)} />);
    await userEvent.type(screen.getByLabelText(/address/i), "GXYZ");
    await userEvent.type(screen.getByLabelText(/credential/i), "kyc");
    await userEvent.click(screen.getByRole("button", { name: /check on-chain/i }));
    expect(await screen.findByText("Not verified")).toBeInTheDocument();
  });
});
