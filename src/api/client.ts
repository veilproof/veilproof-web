// Typed client for veilproof-server's REST API.
//
// This is the ONLY path that talks to the backend. On-chain reads live in
// src/chain and deliberately do not go through here, so the verification
// lookup can be trusted independently of this server.

export interface EncodedProof {
  a: string;
  b: string;
  c: string;
}

export interface ProveResult {
  proof: EncodedProof;
  root: string;
  nullifier: string;
}

export interface IssuerInfo {
  name: string;
  leaf_count: number;
  capacity: number;
  published_root: string | null;
}

/** An error carrying the HTTP status and the server's own message. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}${path}`, {
        ...init,
        headers: { "content-type": "application/json", ...init?.headers },
      });
    } catch {
      throw new ApiError(0, `Could not reach veilproof-server at ${this.baseUrl}`);
    }
    const text = await res.text();
    const body = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const message =
        typeof body?.error === "string" ? body.error : `Request failed (HTTP ${res.status})`;
      throw new ApiError(res.status, message);
    }
    return body as T;
  }

  health(): Promise<{ status: string }> {
    return this.request("/health");
  }

  listIssuers(): Promise<{ issuers: string[] }> {
    return this.request("/issuers");
  }

  issuerInfo(name: string): Promise<IssuerInfo> {
    return this.request(`/issuers/${encodeURIComponent(name)}`);
  }

  addLeaf(name: string, commitment: string): Promise<{ position: number; count: number }> {
    return this.request(`/issuers/${encodeURIComponent(name)}/leaves`, {
      method: "POST",
      body: JSON.stringify({ commitment }),
    });
  }

  publish(name: string): Promise<{ root: string }> {
    return this.request(`/issuers/${encodeURIComponent(name)}/publish`, { method: "POST" });
  }

  getRoot(name: string): Promise<{ root: string }> {
    return this.request(`/issuers/${encodeURIComponent(name)}/root`);
  }

  /**
   * Request a membership proof. The secret is sent to the server, which needs
   * it to build the proof — see the trust note in the UI. `holderAddress` binds
   * the proof to the address that will submit it on-chain.
   */
  prove(name: string, secret: string, holderAddress: string): Promise<ProveResult> {
    return this.request(`/issuers/${encodeURIComponent(name)}/prove`, {
      method: "POST",
      body: JSON.stringify({ secret, holder_address: holderAddress }),
    });
  }
}
