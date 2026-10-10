"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({
  children,
  pendingText,
  className,
  title,
}: {
  children: ReactNode;
  pendingText?: string;
  className: string;
  /** Faqat ikonkali tugma uchun ham nom (tooltip va ekran o'quvchi) */
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className} title={title} aria-label={title} aria-busy={pending}>
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/** Tasdiqlash so'raydigan kichik forma-tugma (o'chirish va h.k.). */
export function ConfirmAction({
  action,
  confirmText,
  children,
  className,
  pendingText,
  title,
  formClassName,
}: {
  action: () => Promise<void>;
  confirmText: string;
  children: ReactNode;
  className: string;
  pendingText?: string;
  title?: string;
  formClassName?: string;
}) {
  return (
    <form
      action={action}
      className={formClassName}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <SubmitButton className={className} pendingText={pendingText} title={title}>
        {children}
      </SubmitButton>
    </form>
  );
}
