// SMS tasdiqlash kodi matni — sof funksiyalar (crypto'siz, brauzerda ham ishlaydi; testlanadi).

/**
 * Standart matn. Eskiz kabinetida («Mening matnlarim») harfma-harf shu matn tasdiqlangan bo'lishi kerak:
 * u yerga {#kod#} o'rniga namuna kod bilan yuboriladi (o'zgaruvchini moderator o'zi belgilaydi).
 * Apostrof — oddiy ' (o‘ kabi belgi bo'lsa SMS Unicode bo'lib, bitta SMS 70 belgiga tushadi).
 */
export const DEFAULT_OTP_TEMPLATE =
  "To'lov nazorati: xodim sifatida ro'yxatdan o'tish yoki parolni tiklash uchun tasdiqlash kodi: {#kod#}. Kodni hech kimga bermang.";

/**
 * Kod o'rni: {#kod#}, {kod} yoki Eskiz moderatori belgilagan istalgan {#...#} — tasdiqlangan
 * matnni Eskiz kabinetidan o'zgartirmasdan ko'chirib qo'yish mumkin.
 */
const CODE_SLOT = /\{#[^#{}]{1,30}#\}|\{#?kod#?\}/g;

export function renderOtpText(template: string, code: string): string {
  return template.replace(CODE_SLOT, code).trim();
}

export function templateHasCode(template: string): boolean {
  return template.search(CODE_SLOT) >= 0;
}
