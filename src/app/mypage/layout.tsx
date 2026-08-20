import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MypageSidebar } from "@/components/mypage/MypageSidebar";
import { AdminTopBar } from "@/components/admin/AdminTopBar";

export default async function MypageLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session?.role !== "clinic_owner") {
    redirect("/");
  }

  return (
    <div className="flex flex-1 flex-col">
      <AdminTopBar email={session.email} />
      <div className="flex flex-1 flex-col lg:flex-row">
        <MypageSidebar />
        <main className="flex-1 overflow-y-auto bg-slate-50 px-4 py-6 sm:px-10 sm:py-10">{children}</main>
      </div>
    </div>
  );
}
