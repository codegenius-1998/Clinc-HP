import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/lib/authActions";

export default async function Home() {
  const session = await getSession();
  if (session?.role !== "clinic_owner") {
    redirect("/");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-sky-50 via-white to-white px-6 py-24 text-center">
      <p className="text-[12px] tracking-[0.35em] text-sky-500">CLINIC HP BUILDER</p>
      <h1 className="mt-6 max-w-xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
        ヒアリングシートから、
        <br />
        クリニックのホームページを。
      </h1>
      <p className="mt-6 max-w-md text-[15px] leading-loose text-slate-500">
        医院の情報を入力するだけで、テンプレートに沿ったホームページを作成できます。作成したホームページはいつでも一覧から確認できます。
      </p>

      <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-center">
        <Link
          href="/create"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-7 py-3.5 text-[13px] font-medium tracking-[0.08em] text-white shadow-sm shadow-sky-200 transition-transform hover:-translate-y-0.5 hover:bg-sky-500"
        >
          ホームページ作成
          <span aria-hidden>→</span>
        </Link>
        <Link
          href="/sites"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-7 py-3.5 text-[13px] font-medium tracking-[0.08em] text-slate-700 transition-colors hover:bg-slate-50"
        >
          閲覧
          <span aria-hidden>→</span>
        </Link>
        <Link
          href="/mypage"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-7 py-3.5 text-[13px] font-medium tracking-[0.08em] text-slate-700 transition-colors hover:bg-slate-50"
        >
          申請・サイト管理
          <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="mt-10 flex items-center justify-center gap-1 text-[13px] text-slate-400">
        <span>{session.email} でログイン中 ·</span>
        <form action={logoutAction}>
          <button type="submit" className="underline underline-offset-4 hover:text-slate-600">
            ログアウト
          </button>
        </form>
      </div>
    </div>
  );
}
