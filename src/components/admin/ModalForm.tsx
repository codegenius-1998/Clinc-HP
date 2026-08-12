"use client";

import { useEffect, useRef } from "react";
import { useActionState } from "react";
import type { ActionState } from "@/lib/contentActions";

/** A trigger button that opens a native <dialog> containing a create-form. The form submits to a
 * Server Action returning `{ error }`; the dialog auto-closes on a successful (error-free) submit. */
export function ModalForm({
  action,
  triggerLabel,
  triggerClassName = "inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-3 text-[15px] font-medium text-white transition-colors hover:bg-slate-700",
  title,
  submitLabel,
  children,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  triggerLabel: string;
  triggerClassName?: string;
  title: string;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(action, { error: null });
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      dialogRef.current?.close();
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <>
      <button type="button" onClick={() => dialogRef.current?.showModal()} className={triggerClassName}>
        {triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        onClose={() => formRef.current?.reset()}
        className="fixed top-1/2 left-1/2 m-0 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 p-0 backdrop:bg-slate-900/40"
      >
        <form ref={formRef} action={formAction} className="flex flex-col gap-5 p-8">
          <h2 className="text-[18px] font-medium text-slate-900">{title}</h2>
          {children}
          {state.error && <p className="text-[14px] text-red-600">{state.error}</p>}
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-lg px-5 py-2.5 text-[15px] text-slate-500 hover:bg-slate-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-slate-700 disabled:pointer-events-none disabled:opacity-60"
            >
              {pending ? "処理中…" : submitLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
