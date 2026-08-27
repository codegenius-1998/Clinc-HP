"use client";

import { useFormStatus } from "react-dom";

/** Progress feedback for the two long-running buttons on /sites/[slug].
 *
 * Both are Server Action form submits with no client state of their own, so before this the page sat
 * completely still while `generateSite` ran — minutes of AI text and 10-20 generated images with no
 * spinner, no disabled button and no message. The only way to tell it was working was that the tab
 * kept loading, and the natural reaction was to press the button again and start a second run.
 *
 * `useFormStatus` has to be read from a component INSIDE the <form>, which is why the button and the
 * banner live in `Body` rather than in the exported wrapper. */

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function Body({
  label,
  pendingLabel,
  note,
  className,
}: {
  label: string;
  pendingLabel: string;
  /** Omitted where there is nowhere sensible to put a banner — a button inside a table cell, say. */
  note?: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <>
      <button type="submit" disabled={pending} className={className}>
        {pending ? (
          <>
            <Spinner />
            {pendingLabel}
          </>
        ) : (
          label
        )}
      </button>
      {pending && note && (
        // role="status" so a screen reader announces the change; the visible text carries the two
        // things a user actually needs to know — that it is working, and that it takes a while.
        <p
          role="status"
          className="mt-2 flex w-full items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] leading-relaxed text-sky-800"
        >
          <span className="mt-0.5 text-sky-600">
            <Spinner />
          </span>
          <span>{note}</span>
        </p>
      )}
    </>
  );
}

export function PendingForm({
  action,
  label,
  pendingLabel,
  note,
  className,
  wrapperClassName,
}: {
  action: () => Promise<void>;
  label: string;
  pendingLabel: string;
  note?: string;
  className: string;
  wrapperClassName?: string;
}) {
  return (
    <form action={action} className={wrapperClassName}>
      <Body label={label} pendingLabel={pendingLabel} note={note} className={className} />
    </form>
  );
}
