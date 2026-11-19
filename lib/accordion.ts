// Ochiladigan kartalar (components/AccordionCard) uchun yordamchilar — server va brauzerda.

/** Uzun ro'yxat: shuncha yoki kamroq element bo'lsa — boshidan ochiq, ko'p bo'lsa — yopiq. */
export const ACCORDION_OPEN_MAX = 3;

/** Ismlar ro'yxatidan qisqa ko'rinish: "Ali, Vali, G'ani va yana 4 ta". */
export function previewNames(names: string[], max = 3): string {
  const uniq = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const head = uniq.slice(0, max).join(", ");
  return uniq.length > max ? `${head} va yana ${uniq.length - max} ta` : head;
}

/** Turlar bo'yicha soni: ["a","b","a"] + nomlar -> "2 ta A · 1 ta B" (ko'pi oldinda). */
export function previewCounts<K extends string>(keys: K[], label: (k: K) => string): string {
  const by = new Map<K, number>();
  for (const k of keys) by.set(k, (by.get(k) ?? 0) + 1);
  return [...by.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${n} ta ${label(k)}`)
    .join(" · ");
}
