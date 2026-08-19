import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { TemplateImportForm } from "@/components/admin/TemplateImportForm";
import { GeneratedSiteImportForm } from "@/components/admin/GeneratedSiteImportForm";
import { listGeneratedSites } from "@/lib/template/importFromGeneratedSite";

export default async function NewTemplatePage() {
  const generatedSites = await listGeneratedSites();

  return (
    <div>
      <Link href="/admin/templates" className="text-[15px] text-slate-400 hover:text-slate-900">
        ← テンプレート管理へ戻る
      </Link>
      <AdminPageHeader
        title="テンプレートを作る"
        description="配色・書体・ブロックの形・アニメーションをテンプレートとして保存します。作成後は編集画面で自由に調整できます。"
      />

      <section className="mb-10">
        <h2 className="mb-1 text-[17px] font-medium text-slate-900">作成済みのサイトから作る</h2>
        <p className="mb-4 text-[14px] text-slate-500">
          このシステムで生成したサイトを元にします。デザインはページに記録された値をそのまま読み取るため、
          元サイトと同じ見た目になります。写真もそのまま引き継ぎます。
        </p>
        <GeneratedSiteImportForm sites={generatedSites} />
      </section>

      <section>
        <h2 className="mb-1 text-[17px] font-medium text-slate-900">外部サイトのURLから作る</h2>
        <p className="mb-4 text-[14px] text-slate-500">
          参考にしたいサイトのHTMLとCSSを解析して、配色・書体・角丸・影・動きを読み取ります。
          文章や写真は取り込みません。
        </p>
        <TemplateImportForm />
      </section>
    </div>
  );
}
