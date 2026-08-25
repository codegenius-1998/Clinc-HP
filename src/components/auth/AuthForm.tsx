"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthFormState } from "@/lib/authActions";

/** Two visual identities, because the two sign-ins are for two different people. The clinic owner's
 * pages carry the warm typographic look introduced on the landing page; the administrator's stay in
 * the panel's neutral ink. Same form, same validation — only the surface differs. */
const ACCENTS = {
  sky: {
    button: "bg-brand hover:bg-brand-deep",
    label: "text-brand",
    ring: "focus:border-brand focus:ring-brand-soft",
  },
  slate: {
    button: "bg-ink hover:bg-brand-deep",
    label: "text-ink-soft",
    ring: "focus:border-ink focus:ring-line",
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
  const inputClass = `w-full rounded-lg border border-line bg-paper px-4 py-3 text-[14px] text-ink outline-none transition-colors focus:ring-2 ${colors.ring}`;

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-canvas px-6 py-24">
      <div className="w-full max-w-sm">
        <p className={`text-center text-[11px] tracking-[0.4em] ${colors.label}`}>{eyebrow}</p>
        <h1 className="mt-5 text-center font-display text-[27px] tracking-[0.14em] text-ink">{title}</h1>

        <form action={formAction} className="mt-10 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[13px] font-medium text-ink-soft">
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
            <label htmlFor="password" className="text-[13px] font-medium text-ink-soft">
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
              <label htmlFor="passwordConfirm" className="text-[13px] font-medium text-ink-soft">
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
            <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className={`mt-3 inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[13px] font-medium tracking-[0.1em] text-paper transition-transform hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60 ${colors.button}`}
          >
            {pending ? "処理中…" : submitLabel}
          </button>
        </form>

        {footer && (
          <p className="mt-8 text-center text-[13px] text-ink-soft">
            <Link href={footer.href} className="text-ink underline underline-offset-8 transition-colors hover:text-brand">
              {footer.label}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
