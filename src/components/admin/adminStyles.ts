// Plain shared style constants for the admin panel. Deliberately NOT in a "use client" file: a
// value export from a client-component module becomes an opaque client reference when imported by
// a Server Component, so a Server Component reading `inputClass` as a string would instead get a
// proxy that throws when rendered. Keeping constants like this here keeps them safe to import from
// both Server and Client Components.
export const inputClass =
  "rounded-lg border border-slate-200 px-3.5 py-2.5 text-[15px] text-slate-900 outline-none transition-colors focus:border-slate-400 focus:ring-1 focus:ring-slate-100";
