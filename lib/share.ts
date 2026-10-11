// Tushumdan hisoblanadigan ulush (masalan, o'qituvchi ulushi).
// Standart foiz .env dagi SHARE_PERCENT (bo'lmasa 40); sozlamalarda oylar bo'yicha o'zgartiriladi.
export { shareOf } from "./fees";

export function sharePercent(): number {
  const n = Number(process.env.SHARE_PERCENT ?? 40);
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : 40;
}
