import { describe, it, expect, vi } from "vitest";
import { ApiClient, ApiError } from "../src/api/client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("ApiClient", () => {
  it("posts a prove request with the secret and holder address", async () => {
    const fetchFn = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(
        jsonResponse(200, { proof: { a: "aa", b: "bb", c: "cc" }, root: "01", nullifier: "02" }),
      ),
    );
    const api = new ApiClient("http://api.test", fetchFn as unknown as typeof fetch);

    const res = await api.prove("kyc", "deadbeef", "GABC");

    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("http://api.test/issuers/kyc/prove");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init!.body as string)).toEqual({
      secret: "deadbeef",
      holder_address: "GABC",
    });
    expect(res.nullifier).toBe("02");
  });

  it("surfaces the server's error message and status", async () => {
    const fetchFn = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(jsonResponse(409, { error: "already registered" })),
    );
    const api = new ApiClient("http://api.test", fetchFn as unknown as typeof fetch);

    await expect(api.addLeaf("kyc", "ff")).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      message: "already registered",
    });
  });

  it("reports an unreachable server as a status-0 ApiError", async () => {
    const fetchFn = vi.fn((_url: string, _init?: RequestInit): Promise<Response> => {
      throw new TypeError("network down");
    });
    const api = new ApiClient("http://api.test", fetchFn as unknown as typeof fetch);
    await expect(api.health()).rejects.toBeInstanceOf(ApiError);
  });
});
