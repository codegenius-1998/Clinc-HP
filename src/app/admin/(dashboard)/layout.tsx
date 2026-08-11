import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session?.role !== "admin") {
    redirect("/admin");
  }

  return (
    <div className="flex flex-1">
      <AdminSidebar email={session.email} />
      <main className="flex-1 overflow-y-auto bg-slate-50 px-10 py-10">{children}</main>
    </div>
  );
}
