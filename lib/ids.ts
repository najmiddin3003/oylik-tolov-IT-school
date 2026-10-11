// Server action argumentlari ishonchsiz (brauzerdan istalgan qiymat yuborilishi mumkin):
// faqat 24 belgili hex qator ko'rinishidagi MongoDB ObjectId qabul qilinadi.
export function isId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);
}
