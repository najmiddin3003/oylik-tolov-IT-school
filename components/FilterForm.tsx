"use client";

import Form from "next/form";
import type { ReactNode } from "react";

/** URL parametrlari bilan ishlaydigan filtr: ro'yxat tanlansa darhol, qidiruv — Enter bosilganda. */
export function FilterForm({ action, className, children }: { action: string; className?: string; children: ReactNode }) {
  return (
    <Form
      action={action}
      className={className}
      role="search"
      onChange={(e) => {
        if (e.target instanceof HTMLSelectElement) e.currentTarget.requestSubmit();
      }}
    >
      {children}
    </Form>
  );
}
