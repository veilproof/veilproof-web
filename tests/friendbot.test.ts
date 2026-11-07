import { describe, expect, it, vi } from "vitest";
import { fundTestnetAccount } from "../src/chain/friendbot";

const respond = (status: number, body = "") =>
  vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;

describe("fundTestnetAccount", () => {
  it("funds through friendbot", async () => {
    const fetchFn = respond(200);
    await fundTestnetAccount("GABC", fetchFn);
    expect(fetchFn).toHaveBeenCalledWith("https://friendbot.stellar.org/?addr=GABC");
  });

  it("treats an account that already exists as funded", async () => {
    await expect(
      fundTestnetAccount("GABC", respond(400, "createAccountAlreadyExist")),
    ).resolves.toBeUndefined();
  });

  it("reports a real failure", async () => {
    await expect(fundTestnetAccount("GABC", respond(500))).rejects.toThrow(/HTTP 500/);
    await expect(fundTestnetAccount("GABC", respond(400, "bad address"))).rejects.toThrow(
      /HTTP 400/,
    );
  });
});
