import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Networks } from "@stellar/stellar-sdk";
import type { ChainReader } from "../src/chain/reads";
import type { Config } from "../src/config";
import type { Prover } from "../src/prover/client";
import { HolderPage } from "../src/pages/HolderPage";
import { IssuerPage } from "../src/pages/IssuerPage";
import { RootStatus } from "../src/components/RootStatus";
import { saveTree } from "../src/tree/treeFile";

vi.mock("../src/chain/submit", () => ({
  submitClaimCredential: vi.fn(async () => "aa".repeat(32)),
  submitPublishRoot: vi.fn(async () => "bb".repeat(32)),
  submitVerifyCredential: vi.fn(async () => "cc".repeat(32)),
}));

const config: Config = {
  registryContractId: "CABC",
  rpcUrl: "https://rpc.test",
  networkPassphrase: Networks.TESTNET,
  circuit: "membership",
};
const ADDRESS = "GBYNOOC3UUF2QBCNIRUEHK2J3JOCDSV2QTLG445GW5ZEENPYDSU33OFQ";
const LEAF = "ab".repeat(32);
const SECRET = "07".padStart(64, "0");

function fakeProver(): Prover {
  return {
    newSecret: vi.fn(async () => ({ secret: SECRET, commitment: LEAF })),
    commitment: vi.fn(async () => LEAF),
    root: vi.fn(async () => "12".repeat(32)),
    prove: vi.fn(async () => ({
      proof: { a: "aa", b: "bb", c: "cc" },
      root: "12".repeat(32),
      nullifier: "34".repeat(32),
    })),
  };
}

function fakeReader(overrides: Partial<ChainReader> = {}): ChainReader {
  return {
    isVerified: async () => false,
    currentRoot: async () => null,
    issuerOf: async () => null,
    openRegistration: async () => true,
    ...overrides,
  };
}

beforeEach(() => localStorage.clear());

describe("RootStatus", () => {
  it("says so when the tree matches the chain", () => {
    render(<RootStatus localRoot={"12".repeat(32)} chainRoot={"12".repeat(32)} />);
    expect(screen.getByText(/matches the root on-chain/)).toBeInTheDocument();
  });

  it("flags a tree that has drifted from the chain", () => {
    render(<RootStatus localRoot={"12".repeat(32)} chainRoot={"34".repeat(32)} />);
    expect(screen.getByRole("status")).toHaveTextContent(/would be rejected/);
  });

  it("flags a root that was never published", () => {
    render(<RootStatus localRoot={"12".repeat(32)} chainRoot={null} />);
    expect(screen.getByRole("status")).toHaveTextContent(/does not match/);
    expect(screen.getByText(/none published/)).toBeInTheDocument();
  });
});

describe("IssuerPage", () => {
  const open = async (reader: ChainReader, address: string | null = ADDRESS) => {
    const user = userEvent.setup();
    render(<IssuerPage config={config} prover={fakeProver()} reader={reader} address={address} />);
    await user.type(screen.getByLabelText(/^credential/i), "mycred");
    await user.click(screen.getByRole("button", { name: /open credential/i }));
    return user;
  };

  it("offers a free name for claiming on an open registry", async () => {
    await open(fakeReader());
    expect(
      await screen.findByRole("button", { name: /claim "mycred" as issuer/i }),
    ).toBeInTheDocument();
  });

  it("does not offer to claim on a closed registry", async () => {
    await open(fakeReader({ openRegistration: async () => false }));
    expect(await screen.findByText(/only accepts issuers its admin/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /claim/i })).not.toBeInTheDocument();
  });

  it("will not let a wallet that is not the issuer publish", async () => {
    await open(fakeReader({ issuerOf: async () => "GOTHERISSUER" }));
    expect(await screen.findByText(/is not this credential's issuer/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /publish current root/i })).toBeNull();
  });

  it("adds a commitment, saves it, and shows the drift until published", async () => {
    const user = await open(fakeReader({ issuerOf: async () => ADDRESS }));
    await user.type(await screen.findByLabelText(/leaf commitment/i), LEAF);
    await user.click(screen.getByRole("button", { name: /add commitment/i }));

    expect(await screen.findByText(LEAF)).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent(/does not match/);
    expect(localStorage.getItem("veilproof:tree:CABC:mycred")).toContain(LEAF);
    expect(screen.getByRole("button", { name: /publish current root/i })).toBeEnabled();
  });

  it("shows a bad commitment as an error, adding nothing", async () => {
    const user = await open(fakeReader({ issuerOf: async () => ADDRESS }));
    await user.type(await screen.findByLabelText(/leaf commitment/i), "nope");
    await user.click(screen.getByRole("button", { name: /add commitment/i }));
    expect(await screen.findByText(/64 hex characters/)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 16 members/)).toBeInTheDocument();
  });
});

describe("HolderPage", () => {
  it("labels the secret and the commitment so they cannot be confused", async () => {
    const user = userEvent.setup();
    render(
      <HolderPage config={config} prover={fakeProver()} reader={fakeReader()} address={ADDRESS} />,
    );
    await user.click(screen.getByRole("button", { name: /generate a secret/i }));

    const secret = (await screen.findByText(/your secret: keep this private/i)).parentElement!;
    expect(within(secret).getByText(SECRET)).toBeInTheDocument();
    const shared = screen.getByText(/your commitment: give this to the issuer/i).parentElement!;
    expect(within(shared).getByText(LEAF)).toBeInTheDocument();
    expect(within(shared).queryByText(SECRET)).toBeNull();
  });

  it("never persists the secret", async () => {
    const user = userEvent.setup();
    render(
      <HolderPage config={config} prover={fakeProver()} reader={fakeReader()} address={ADDRESS} />,
    );
    await user.click(screen.getByRole("button", { name: /generate a secret/i }));
    await screen.findByText(SECRET);
    await user.type(screen.getByLabelText(/your secret \(hex\)/i), SECRET);

    expect(JSON.stringify({ ...localStorage })).not.toContain(SECRET);
  });

  it("proves from the loaded tree, for the connected address, and submits", async () => {
    saveTree({ version: 1, contractId: "CABC", credential: "mycred", leaves: [LEAF] });
    const prover = fakeProver();
    const user = userEvent.setup();
    render(
      <HolderPage
        config={config}
        prover={prover}
        reader={fakeReader({ currentRoot: async () => "12".repeat(32) })}
        address={ADDRESS}
      />,
    );

    await user.type(screen.getByLabelText(/^credential/i), "mycred");
    await user.click(screen.getByRole("button", { name: /use the copy in this browser/i }));
    expect(await screen.findByText(/matches the root on-chain/)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/your secret \(hex\)/i), SECRET);
    await user.click(screen.getByRole("button", { name: /^generate proof/i }));
    expect(prover.prove).toHaveBeenCalledWith([LEAF], SECRET, ADDRESS);

    await user.click(await screen.findByRole("button", { name: /submit on-chain/i }));
    expect(await screen.findByRole("link", { name: /stellar expert/i })).toHaveAttribute(
      "href",
      `https://stellar.expert/explorer/testnet/tx/${"cc".repeat(32)}`,
    );
  });

  it("cannot prove before a tree is loaded", () => {
    render(
      <HolderPage config={config} prover={fakeProver()} reader={fakeReader()} address={ADDRESS} />,
    );
    expect(screen.getByRole("button", { name: /^generate proof/i })).toBeDisabled();
  });
});
