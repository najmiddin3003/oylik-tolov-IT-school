// Tushumdan hisoblanadigan ulush (masalan, o'qituvchi ulushi).
// Foiz .env dagi SHARE_PERCENT orqali o'zgartiriladi, standart — 40.

export function sharePercent(): number {
  const n = Number(process.env.SHARE_PERCENT ?? 40);
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : 40;
}

/** Summaning ulushi (so'mgacha yaxlitlangan). */
export function shareOf(amount: number, percent: number = sharePercent()): number {
  return Math.round((amount * percent) / 100);
}
