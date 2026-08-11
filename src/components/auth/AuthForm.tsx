"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthFormState } from "@/lib/authActions";

const ACCENTS = {
  sky: {
    button: "bg-sky-600 hover:bg-sky-500 shadow-sky-200",
    label: "text-sky-500",
    ring: "focus:border-sky-400 focus:ring-sky-100",
  },
  slate: {
    button: "bg-slate-800 hover:bg-slate-700 shadow-slate-200",
    label: "text-slate-400",
    ring: "focus:border-slate-400 focus:ring-slate-100",
  },
} as const;

export function AuthForm({
  action,
  eyebrow,
  title,
  submitLabel,
  accent = "sky",
  showConfirmPassword = false,
  footer,
}: {
  action: (prevState: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  eyebrow: string;
  title: string;
  submitLabel: string;
  accent?: keyof typeof ACCENTS;
  showConfirmPassword?: boolean;
  footer?: { href: string; label: string };
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const colors = ACCENTS[accent];
  const inputClass = `w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] text-slate-900 outline-none transition-colors ${colors.ring}`;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm">
        <p className={`text-center text-[12px] tracking-[0.35em] ${colors.label}`}>{eyebrow}</p>
        <h1 className="mt-4 text-center text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>

        <form action={formAction} className="mt-10 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[13px] font-medium text-slate-600">
              メールアドレス
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className={inputClass}
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-[13px] font-medium text-slate-600">
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete={showConfirmPassword ? "new-password" : "current-password"}
              minLength={showConfirmPassword ? 8 : undefined}
              className={inputClass}
              placeholder="••••••••"
            />
          </div>

          {showConfirmPassword && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="passwordConfirm" className="text-[13px] font-medium text-slate-600">
                パスワード（確認）
              </label>
              <input
                id="passwordConfirm"
                name="passwordConfirm"
                type="password"
                required
                autoComplete="new-password"
                minLength={8}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>
          )}

          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className={`mt-2 inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[13px] font-medium tracking-[0.08em] text-white shadow-sm transition-transform hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60 ${colors.button}`}
          >
            {pending ? "処理中…" : submitLabel}
          </button>
        </form>

        {footer && (
          <p className="mt-6 text-center text-[13px] text-slate-500">
            <Link href={footer.href} className="text-slate-700 underline underline-offset-4 hover:text-slate-900">
              {footer.label}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
