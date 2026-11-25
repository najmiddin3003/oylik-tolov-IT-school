"use client";

// «Profilim»: o'z rasmini qo'yish / almashtirish / olib tashlash (darhol saqlanadi).
import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { setMyPhoto } from "@/app/actions/me";
import { shrink } from "./PhotoField";
import { cx } from "./ui";

export function MyPhoto({ photoUrl, className, fallback }: { photoUrl: string | null; className: string; fallback: React.ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(photoUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (value: string, next: string | null) =>
    start(async () => {
      setError(null);
      const prev = preview;
      setPreview(next);
      const res = await setMyPhoto(value).catch(() => ({ ok: false as const, error: "Tarmoq xatosi — qayta urinib ko‘ring" }));
      if (!res.ok) {
        setPreview(prev);
        setError(res.error);
      }
    });

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={pending}
        className={cx("group relative", className)}
        aria-label={preview ? "Rasmni almashtirish" : "Rasm yuklash"}
        title={preview ? "Rasmni almashtirish" : "Rasm yuklash"}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          fallback
        )}
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Camera className="size-5" aria-hidden />}
        </span>
      </button>
      <div className="flex items-center gap-2 text-xs">
        <button type="button" onClick={() => input.current?.click()} disabled={pending} className="font-medium text-brand-600 hover:text-brand-800 disabled:opacity-60">
          {preview ? "Almashtirish" : "Rasm qo‘yish"}
        </button>
        {preview ? (
          <button type="button" onClick={() => save("remove", null)} disabled={pending} className="inline-flex items-center gap-0.5 text-ink-400 hover:text-rose-600 disabled:opacity-60" aria-label="Rasmni olib tashlash">
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="max-w-48 text-xs text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label="Rasm tanlash"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            const data = await shrink(file);
            save(data, data);
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      />
    </div>
  );
}
