"use client";

// Chek sahifasi tugmalari: chop etish / PDF saqlash (brauzerning chop etish oynasi — «PDF sifatida saqlash»).
// ?print=1 bilan ochilsa — chop etish oynasi o'zi ochiladi. Ctrl+P (⌘P) — brauzerning o'zi, sahifada faqat chek chiqadi.
import { useEffect } from "react";
import { ArrowLeft, Printer, ReceiptText } from "lucide-react";
import { btn, cx } from "./ui";

export function ReceiptActions({ autoPrint, backHref }: { autoPrint: boolean; backHref: string }) {
  useEffect(() => {
    if (!autoPrint) return;
    const t = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(t);
  }, [autoPrint]);
  return (
    <div className="mx-auto mb-5 flex w-full max-w-[440px] flex-wrap items-center gap-2 print:hidden">
      <a href={backHref} className={btn.outline}>
        <ArrowLeft className="size-4" aria-hidden />
        Orqaga
      </a>
      <button type="button" onClick={() => window.print()} className={cx(btn.primary, "ml-auto")}>
        <Printer className="size-[18px]" aria-hidden />
        Chop etish / PDF
      </button>
      <p className="w-full text-xs text-ink-400">PDF uchun chop etish oynasida «PDF sifatida saqlash»ni tanlang. Tugma: Ctrl + P.</p>
    </div>
  );
}

/**
 * To'lov formasi yonida: to'lov saqlangach Ctrl + P (⌘P) — butun sahifa emas, shu to'lov cheki chop etiladi
 * (chek yangi oynada ochiladi va chop etish oynasi chiqadi).
 */
export function ReceiptHotkey({ receiptId }: { receiptId: string | undefined }) {
  useEffect(() => {
    if (!receiptId) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        window.open(`/chek/${receiptId}?print=1`, "_blank", "noopener");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [receiptId]);
  return null;
}

/** To'lov qatoridagi chek tugmasi (yangi oynada; u yerda — chop etish / PDF). */
export function ReceiptLink({ paymentId }: { paymentId: string }) {
  return (
    <a href={`/chek/${paymentId}`} target="_blank" rel="noopener" className={btn.icon} title="To‘lov cheki (chop etish / PDF)" aria-label="To‘lov cheki">
      <ReceiptText className="size-[18px]" strokeWidth={1.8} aria-hidden />
    </a>
  );
}
