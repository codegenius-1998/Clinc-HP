import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MypageSidebar } from "@/components/mypage/MypageSidebar";
import { MypageTopBar } from "@/components/mypage/MypageShell";

export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session?.role !== "clinic_owner") {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col">
      <MypageTopBar email={session.email} />
      <div className="flex flex-1">
        <MypageSidebar />
        <main className="flex-1 overflow-y-auto bg-canvas px-5 py-10 sm:px-10 sm:py-14">{children}</main>
      </div>
    </div>
  );
}
