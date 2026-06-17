import { Outlet } from "react-router-dom"

import { AppHeader } from "@/components/layout/AppHeader"
import { NavRail } from "@/components/layout/NavRail"

export function AppLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <NavRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
