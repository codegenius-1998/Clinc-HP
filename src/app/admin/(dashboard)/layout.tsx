import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopBar } from "@/components/admin/AdminTopBar";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session?.role !== "admin") {
    redirect("/admin");
  }

  return (
    <div className="flex flex-1 flex-col">
      <AdminTopBar email={session.email} />
      <div className="flex flex-1 flex-col md:flex-row">
        <AdminSidebar />
        <main className="min-w-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-6 md:px-10 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
