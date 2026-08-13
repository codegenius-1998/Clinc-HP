import Link from "next/link";
import { listColorPalette } from "@/lib/designPresets";
import { listDepartments, listServices, listFeatures, listTargets } from "@/lib/content";
import { ApplyForm } from "@/components/apply/ApplyForm";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default async function MypageApplyPage() {
  const colors = listColorPalette();
  const [departments, services, features, targets] = await Promise.all([
    listDepartments(),
    listServices(),
    listFeatures(),
    listTargets(),
  ]);

  return (
    <div>
      <Link href="/mypage/requests" className="text-[13px] text-slate-400 transition-colors hover:text-slate-900">
        ← 申請一覧へ戻る
      </Link>
      <div className="mt-6">
        <AdminPageHeader title="新規申請" description="ホームページ作成の申請内容を入力してください。" />
      </div>
      <div className="max-w-2xl">
        <ApplyForm colors={colors} departments={departments} services={services} features={features} targets={targets} />
      </div>
    </div>
  );
}
