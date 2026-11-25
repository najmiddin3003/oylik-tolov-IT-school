"use client";

// Rasm tanlash (ixtiyoriy): brauzerda 320 px gacha kichraytirilib, JPEG ko'rinishida yashirin maydonga yoziladi.
// "" — o'zgarmaydi, "remove" — o'chiriladi. O'quvchi va xodim formalarida.
import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { cx } from "./ui";

const SIZE = 320;

/** Rasmni kvadrat qilib (markazdan) kichraytirish — data URL. */
export async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Rasmni o‘qib bo‘lmadi"));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const out = Math.min(SIZE, side);
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Rasmni o‘qib bo‘lmadi");
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PhotoField({ current, initials, name = "photo", label = "Rasm" }: { current: string | null; initials: string; name?: string; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [preview, setPreview] = useState<string | null>(current);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-4">
      <span className="relative inline-flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br from-brand-100 to-brand-200 text-lg font-semibold text-brand-700 ring-1 ring-inset ring-line">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          initials || <Camera className="size-6" aria-hidden />
        )}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-700">
          {label} <span className="font-normal text-ink-400">(ixtiyoriy)</span>
        </p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
          >
            <Camera className="size-4" aria-hidden />
            {preview ? "Almashtirish" : "Rasm tanlash"}
          </button>
          {preview ? (
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setValue(current ? "remove" : "");
                if (input.current) input.current.value = "";
              }}
              className={cx("inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-ink-500 transition hover:bg-rose-50 hover:text-rose-600")}
            >
              <Trash2 className="size-4" aria-hidden />
              Olib tashlash
            </button>
          ) : null}
        </div>
        {error ? (
          <p className="mt-1 text-xs text-rose-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label={label}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setError(null);
          try {
            const data = await shrink(file);
            setPreview(data);
            setValue(data);
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      />
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
