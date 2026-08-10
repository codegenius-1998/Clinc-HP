import Link from "next/link";
import { listDesignPresets } from "@/lib/designPresets";
import { getBodySections } from "@/lib/siteSpec";
import { HearingSheetForm } from "@/components/create/HearingSheetForm";

export default async function CreateSitePage() {
  const presets = listDesignPresets();
  const sections = getBodySections();

  return (
    <div className="flex-1 bg-gradient-to-b from-sky-50 via-white to-white px-6 py-24">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-[13px] text-slate-400 transition-colors hover:text-slate-900"
        >
          ← トップへ戻る
        </Link>

        <p className="mt-8 text-[12px] tracking-[0.35em] text-sky-500">HEARING SHEET</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          ヒアリングシート
        </h1>
        <p className="mt-4 max-w-md text-[14px] leading-loose text-slate-500">
          ホームページの元になる情報を入力してください。入力内容をもとにホームページを作成します。
        </p>

        <div className="mt-12">
          <HearingSheetForm presets={presets} sections={sections} />
        </div>
      </div>
    </div>
  );
}
