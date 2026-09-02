import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listHearingsByOwner } from "@/lib/hearing";
import { MypagePageHeader, MypagePrimaryLink } from "@/components/mypage/MypageShell";

/** The clinic owner's first screen after signing in. Leads with how many applications they have
 * submitted, then the navigation. */

const LINKS = [
  { href: "/mypage/apply", label: "新規申請", description: "ホームページ作成の申請を行います。" },
  { href: "/mypage/requests", label: "申請一覧", description: "送信した申請の内容を確認します。" },
];

export default async function Home() {
  const session = await getSession();
  if (session?.role !== "clinic_owner") {
    redirect("/login");
  }

  const hearings = await listHearingsByOwner(session.email);

  return (
    <div>
      <MypagePageHeader
        title="ようこそ"
        description="医院の情報を入力して、ホームページ作成の申請を送信できます。"
      />

      {hearings.length === 0 ? (
        <div className="border border-line bg-paper px-7 py-12 text-center sm:px-10">
          <p className="font-display text-[19px] tracking-[0.08em] text-ink">まだ申請がありません</p>
          <p className="mx-auto mt-4 max-w-md text-[14px] leading-[2] text-ink-soft">
            医院名・診療時間・スタッフ・料金など、お手元にある情報を10ステップで入力します。途中で保存できます。
          </p>
          <div className="mt-9">
            <MypagePrimaryLink href="/mypage/apply">最初の申請をはじめる</MypagePrimaryLink>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="border border-line bg-paper px-6 py-7">
            <p className="text-[12px] tracking-[0.2em] text-ink-soft">送信済みの申請</p>
            <p className="mt-3 font-display text-[30px] leading-none text-ink">{hearings.length}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <MypagePrimaryLink href="/mypage/apply">新しく申請する</MypagePrimaryLink>
            <Link
              href="/mypage/requests"
              className="text-[13px] text-ink-soft underline underline-offset-8 transition-colors hover:text-ink"
            >
              申請の内容を確認する
            </Link>
          </div>
        </div>
      )}

      <div className="mt-14 grid gap-px border-t border-line sm:grid-cols-2">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group border-b border-line bg-transparent py-7 transition-colors sm:px-6"
          >
            <p className="flex items-center gap-2 font-display text-[16px] tracking-[0.08em] text-ink">
              {link.label}
              <span aria-hidden className="text-brand transition-transform group-hover:translate-x-1">
                →
              </span>
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{link.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
