/** Комиссия платформы в базисных пунктах (1% = 100 bps). */
export function computeVprokSettlement(grossCents: number, feeBps: number) {
  if (grossCents < 0 || feeBps < 0 || feeBps > 10_000) {
    throw new Error("Invalid settlement inputs");
  }
  const platformFeeCents = Math.round((grossCents * feeBps) / 10_000);
  const retailerPayoutCents = grossCents - platformFeeCents;
  return {
    platformFeeBps: feeBps,
    platformFeeCents,
    retailerPayoutCents
  };
}
