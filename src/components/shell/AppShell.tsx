import type { ReactNode } from "react";
import { Outlet } from "@tanstack/react-router";
import { TopNav } from "./TopNav";

export function AppShell({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <TopNav />
      <main className="flex-1">
        <div className="mx-auto max-w-[1400px] px-6 py-6">
          {children ?? <Outlet />}
        </div>
      </main>
    </div>
  );
}
