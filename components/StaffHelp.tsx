"use client";

// «Xodim qanday kiradi?» — tugma bosilganda modal oynada qisqa yo'riqnoma.
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { CircleHelp, KeyRound, MessageSquareText, Smartphone, UserPlus } from "lucide-react";
import { Modal, ModalBody, ModalHeader } from "./Modal";
import { btn, cx } from "./ui";

function Step({ icon: Icon, n, children }: { icon: typeof UserPlus; n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="num inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 ring-1 ring-inset ring-brand-100">{n}</span>
      <span className="pt-0.5">
        <Icon className="mr-1.5 inline size-3.5 -translate-y-px text-ink-400" aria-hidden />
        {children}
      </span>
    </li>
  );
}

export function StaffHelpButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cx(btn.outline, "group")}>
        <CircleHelp className="size-[18px] text-brand-600" aria-hidden />
        Xodim qanday kiradi?
      </button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy="staff-help-title" size="sm">
        <ModalHeader id="staff-help-title" icon={CircleHelp} tone="brand" title="Xodim qanday kiradi?" subtitle="3 qadam — SMS kod bilan" onClose={() => setOpen(false)} />
        <ModalBody>
          <ol className="grid gap-4 text-sm leading-relaxed text-ink-600">
            <Step icon={UserPlus} n={1}>
              Siz uni «Xodimlar» sahifasida telefon raqami bilan qo‘shasiz.
            </Step>
            <Step icon={Smartphone} n={2}>
              U kirish sahifasida telefon raqamini kiritadi — <b className="font-semibold text-ink-800">birinchi marta</b> raqamiga SMS kod keladi.
            </Step>
            <Step icon={KeyRound} n={3}>
              Kodni kiritib, o‘zi parol qo‘yadi. Keyingi safar SMS kelmaydi — telefon raqami va o‘z paroli bilan kiradi. Parolni unutsa — «Parolni unutdingizmi?» orqali tiklaydi.
            </Step>
          </ol>
          <Link
            href="/settings#sms"
            onClick={() => setOpen(false)}
            className="mt-5 flex items-start gap-2.5 rounded-xl bg-sky-50 px-3.5 py-3 text-[13px] leading-relaxed text-sky-900 transition hover:bg-sky-100/70"
          >
            <MessageSquareText className="mt-0.5 size-4 shrink-0 text-sky-600" aria-hidden />
            <span>
              SMS kod matni Eskiz kabinetida tasdiqlangan bo‘lishi kerak — matnni <b className="font-semibold">Sozlamalar → SMS</b> bo‘limidan oling.
            </span>
          </Link>
        </ModalBody>
      </Modal>
    </>
  );
}
