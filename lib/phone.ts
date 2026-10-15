// O'zbekiston telefon raqamlari (sof funksiyalar — server va brauzerda).

/** "+998 33 626 30 06" -> "998336263006" */
export function normalizeUzPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9) return `998${digits}`;
  if (digits.length === 12 && digits.startsWith("998")) return digits;
  return null;
}

export function formatUzPhone(digits: string): string {
  const d = normalizeUzPhone(digits);
  if (!d) return digits;
  return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
}
