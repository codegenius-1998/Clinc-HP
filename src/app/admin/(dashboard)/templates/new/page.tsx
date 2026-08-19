import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { TemplateImportForm } from "@/components/admin/TemplateImportForm";

export default function NewTemplatePage() {
  return (
    <div>
      <Link href="/admin/templates" className="text-[15px] text-slate-400 hover:text-slate-900">
        ← テンプレート管理へ戻る
      </Link>
      <AdminPageHeader
        title="URLからテンプレートを作る"
        description="参考にしたいサイトのURLや画像から、配色・書体・ブロックの形・アニメーションを読み取ってテンプレートにします。"
      />
      <TemplateImportForm />
    </div>
  );
}
