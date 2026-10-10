export type FormState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Har muvaffaqiyatli saqlashda o'zgaradi — forma maydonlarini yangilash uchun */
  nonce?: number;
};
