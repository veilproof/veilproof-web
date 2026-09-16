import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrustNotice } from "../src/components/TrustNotice";

// The whole value of the tool is an honest privacy claim. These tests guard
// the copy from silently drifting into overstating it.
describe("TrustNotice", () => {
  it("states that the secret is sent to the server", () => {
    render(<TrustNotice />);
    expect(screen.getByText(/secret is sent to the veilproof-server/i)).toBeInTheDocument();
  });

  it("does not claim the secret never leaves the browser", () => {
    render(<TrustNotice />);
    expect(screen.queryByText(/never leaves your (browser|device)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/stays (local|on your device)/i)).not.toBeInTheDocument();
  });

  it("says the contract stores only hashes, not identity data", () => {
    render(<TrustNotice />);
    expect(screen.getByText(/never sees or stores raw identity data/i)).toBeInTheDocument();
  });
});
