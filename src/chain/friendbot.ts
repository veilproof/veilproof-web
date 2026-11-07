// A new testnet wallet has no account on-chain until it holds some XLM, so nothing
// it signs can land. Friendbot gives away testnet XLM, which has no value.

export async function fundTestnetAccount(
  address: string,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchFn(`https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`);
  if (res.ok) return;
  // Friendbot answers 400 for an account it has already funded, which is fine:
  // the account exists and has a balance.
  const body = await res.text();
  if (res.status === 400 && /already|exists/i.test(body)) return;
  throw new Error(`Friendbot could not fund this account (HTTP ${res.status}).`);
}
