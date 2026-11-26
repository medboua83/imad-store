/** Display only. Never use a localized label in prices, payments or API payloads. */
const amount = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export function formatStoreAmount(value: number): string {
  return Number.isFinite(value) ? amount.format(value) : "—";
}
export function formatStoreMoney(value: number): string {
  return Number.isFinite(value) ? `${formatStoreAmount(value)} MAD` : "—";
}
