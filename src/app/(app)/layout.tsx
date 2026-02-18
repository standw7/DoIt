import { NavWrapper } from "@/components/nav/nav-wrapper";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <NavWrapper>{children}</NavWrapper>;
}
