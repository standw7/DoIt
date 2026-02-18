import { BottomNav } from "./bottom-nav";
import { SidebarNav } from "./sidebar-nav";

export function NavWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SidebarNav />
      <main className="pb-20 md:pb-0 md:pl-56">{children}</main>
      <BottomNav />
    </div>
  );
}
