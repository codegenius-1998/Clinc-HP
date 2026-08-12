"use client";

import { useRef } from "react";

/** A "削除" link/button that opens a confirmation modal before actually submitting the delete
 * Server Action. `action` is a bound action (e.g. `deleteUserAction.bind(null, user.id)`). */
export function ConfirmDeleteButton({
  action,
  confirmText,
  label = "削除",
  className = "text-slate-400 underline underline-offset-4 hover:text-red-600",
}: {
  action: () => Promise<void>;
  confirmText: string;
  label?: string;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button type="button" onClick={() => dialogRef.current?.showModal()} className={className}>
        {label}
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="fixed top-1/2 left-1/2 m-0 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 p-0 backdrop:bg-slate-900/40"
      >
        <div className="flex flex-col items-center gap-5 p-8 text-center">
          <p className="text-[16px] text-slate-900">{confirmText}</p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-lg px-5 py-2.5 text-[15px] text-slate-500 hover:bg-slate-50"
            >
              キャンセル
            </button>
            <form action={action}>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-5 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-red-500"
              >
                削除する
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
