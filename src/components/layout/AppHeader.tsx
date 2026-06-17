import { useEffect, useState } from "react"
import { Coffee } from "lucide-react"

import { getCurrentShift, type Shift } from "@/lib/api/shifts"

function formatNow(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export function AppHeader() {
  const [shift, setShift] = useState<Shift | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let active = true

    getCurrentShift()
      .then((nextShift) => {
        if (active) setShift(nextShift)
      })
      .catch(() => {
        if (active) setShift(null)
      })

    const interval = window.setInterval(() => setNow(new Date()), 60_000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  return (
    <header className="flex h-20 shrink-0 items-center justify-between border-b bg-card px-6">
      <div className="flex min-w-0 items-center gap-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <Coffee className="size-6" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">HiGi POS</h1>
          <p className="truncate text-xs font-medium text-muted-foreground">
            {shift ? "Đang mở ca" : "Chưa mở ca"} · Offline · Quầy chính
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#E9F7F0] px-3 py-1 text-xs font-bold text-[#167A50]">
          <span className="size-2 rounded-full bg-[#22A06B]" />
          Đã đồng bộ cục bộ
        </span>
        <time className="text-right text-sm font-bold" dateTime={now.toISOString()}>
          {formatNow(now)}
        </time>
      </div>
    </header>
  )
}
