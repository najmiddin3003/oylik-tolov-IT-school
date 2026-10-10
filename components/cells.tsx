// Jadval kataklari (server va client jadvallarda birga ishlatiladi).
import Link from "next/link";
import { formatNumber } from "@/lib/time";
import { Avatar, cx, Progress, studentCode } from "./ui";

export function StudentCell({
  id,
  name,
  seq,
  phone,
  href,
  muted = false,
}: {
  id: string;
  name: string;
  seq: number | null;
  phone: string;
  href?: string;
  muted?: boolean;
}) {
  const code = studentCode(seq);
  return (
    <div className={cx("flex min-w-0 items-center gap-3.5", muted && "opacity-60")}>
      <Avatar name={name} />
      <div className="min-w-0">
        <Link href={href ?? `/students/${id}`} className="block truncate text-[15px] font-medium text-ink-900 hover:text-brand-600">
          {name}
        </Link>
        <p className="num mt-0.5 truncate text-[13px] text-ink-400">
          {code ? `${code} · ` : ""}
          {phone || "Telefon kiritilmagan"}
        </p>
      </div>
    </div>
  );
}

export function PaidCell({ paid, fee }: { paid: number; fee: number }) {
  return (
    <div className="w-32">
      <p className="num whitespace-nowrap text-sm">
        <span className="font-semibold text-ink-900">{formatNumber(paid)}</span>
        <span className="text-ink-400"> / {formatNumber(fee)}</span>
      </p>
      <Progress value={paid} max={fee} className="mt-2 h-1" />
    </div>
  );
}
