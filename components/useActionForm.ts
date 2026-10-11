"use client";

// Server action'ni forma bilan ishlatish, lekin React 19 ning avtomatik "forma tozalash"isiz:
// <form action={fn}> har yuborilgandan keyin (xato qaytsa ham) boshqarilmaydigan maydonlarni tozalab yuboradi —
// natijada xato chiqqanda foydalanuvchi kiritgan ma'lumot yo'qolardi. Bu yerda forma onSubmit orqali yuboriladi.
import { startTransition, useActionState, type FormEvent } from "react";
import type { FormState } from "@/app/actions/types";

export function useActionForm<S extends FormState = FormState>(action: (prev: S, formData: FormData) => Promise<S>, initial: S) {
  const [state, formAction, pending] = useActionState<S, FormData>(
    action as (prev: Awaited<S>, formData: FormData) => Promise<S>,
    initial as Awaited<S>,
  );
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  };
  return [state, onSubmit, pending] as const;
}
