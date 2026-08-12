"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/contentActions";

/** Generic create-form wrapper: renders the given fields, submits to a Server Action returning
 * `{ error }`, and shows a pending state + inline error. Used by every admin "create X" form. */
export function AdminForm({
  action,
  children,
  submitLabel,
  className = "flex flex-wrap items-end gap-3",
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submitLabel: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className={className}>
      {children}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-slate-700 disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? "処理中…" : submitLabel}
      </button>
      {state.error && <p className="basis-full text-[14px] text-red-600">{state.error}</p>}
    </form>
  );
}
