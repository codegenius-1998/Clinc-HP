import { logoutAction } from "@/lib/authActions";

export function AdminTopBar({ email }: { email: string }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-end gap-4 border-b border-slate-200 bg-white px-8">
      <span className="text-[15px] text-slate-500">{email}</span>
      <form action={logoutAction}>
        <button type="submit" className="text-[15px] text-slate-400 underline underline-offset-4 hover:text-slate-900">
          ログアウト
        </button>
      </form>
    </header>
  );
}
