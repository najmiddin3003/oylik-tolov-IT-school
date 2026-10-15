"use client";

// Rahbar → administrator topshiriqlari: yuborish (eslatma bannerida) va «Bajarildi» (administratorda).
import { useState, useTransition } from "react";
import { CheckCheck, LoaderCircle, Send } from "lucide-react";
import { completeTask, sendCollectTask } from "@/app/actions/tasks";
import type { TaskRow } from "@/lib/tasks";
import { formatDateTime } from "@/lib/time";
import { btn, cx } from "./ui";

/** Rahbar: «Administratorga topshiriq yuborish». Yuborilgan bo'lsa — holati va qayta yuborish. */
export function SendTaskButton({ month, task, tone }: { month: string; task: TaskRow | null; tone: "rose" | "amber" }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const send = () =>
    startTransition(async () => {
      const res = await sendCollectTask(month);
      setMsg(res.ok ? { ok: true, text: res.message ?? "Yuborildi" } : { ok: false, text: res.error ?? "Yuborilmadi" });
    });

  const base = cx(
    "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-surface px-4 text-sm font-semibold shadow-card ring-1 ring-inset transition disabled:opacity-60 sm:w-auto",
    tone === "rose" ? "text-rose-700 ring-rose-200 hover:bg-rose-50" : "text-amber-800 ring-amber-200 hover:bg-amber-50",
  );

  return (
    <div className="flex w-full flex-col items-stretch gap-1.5 sm:w-auto sm:items-end">
      <button type="button" onClick={send} disabled={pending} className={base}>
        {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
        {task?.status === "open" ? "Topshiriqni yangilash" : "Administratorga topshiriq yuborish"}
      </button>
      {msg ? (
        <span className={cx("text-xs font-medium", msg.ok ? "text-emerald-700" : "text-rose-700")} role="status">
          {msg.ok ? "✓ " : ""}
          {msg.text}
        </span>
      ) : task ? (
        <span className="num text-xs text-ink-500">
          {task.status === "open"
            ? `Yuborilgan: ${formatDateTime(task.updatedAt)} · bajarilishi kutilmoqda`
            : `Bajarildi ✓ ${task.doneByName ? `${task.doneByName}, ` : ""}${formatDateTime(task.doneAt)}`}
        </span>
      ) : null}
    </div>
  );
}

/** Administrator: topshiriqni bajarildi deb belgilash. */
export function CompleteTaskButton({ id, className }: { id: string; className?: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await completeTask(id);
            if (!res.ok) setError(res.error ?? "Saqlanmadi");
          })
        }
        className={cx(btn.sm, "text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800", className)}
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <CheckCheck className="size-4" aria-hidden />}
        Bajarildi
      </button>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </span>
  );
}
