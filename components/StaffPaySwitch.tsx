"use client";

// Xodim: «Oylik hisoblash» switch'i (rahbar). Bosilishi bilan saqlanadi.
import { useOptimistic, useTransition } from "react";
import { setStaffPayEnabled } from "@/app/actions/staff";
import { Switch } from "./Switch";
import { cx } from "./ui";

export function StaffPaySwitch({ id, name, on, withLabel = true, className }: { id: string; name: string; on: boolean; withLabel?: boolean; className?: string }) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useOptimistic(on);
  const toggle = (v: boolean) =>
    startTransition(async () => {
      setValue(v);
      await setStaffPayEnabled(id, v);
    });
  return (
    <label className={cx("inline-flex cursor-pointer items-center gap-2.5 text-sm", className)} title={value ? "Oylik hisoblanadi" : "Oylik hisoblanmaydi"}>
      <Switch checked={value} onChange={toggle} label={`${name} — oylik hisoblash`} disabled={pending} />
      {withLabel ? <span className={cx("font-medium", value ? "text-emerald-700" : "text-ink-500")}>{value ? "Oylik hisoblanadi" : "Oylik hisoblanmaydi"}</span> : null}
    </label>
  );
}
