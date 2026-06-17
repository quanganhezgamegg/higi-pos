import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { Order } from "@/lib/api/orders"
import type { SalesSummary } from "@/lib/api/reports"
import type { Shift } from "@/lib/api/shifts"
import type { TableStatus } from "@/lib/api/tables"
import { listOpenOrders } from "@/lib/api/orders"
import { reportSalesSummary } from "@/lib/api/reports"
import { getCurrentShift } from "@/lib/api/shifts"
import { listTableStatus } from "@/lib/api/tables"
import { formatVnd } from "@/lib/format"

type ChartPoint = {
  day: string
  revenue: number
}

const emptySummary: SalesSummary = {
  revenue: 0,
  order_count: 0,
  avg_order_value: 0,
  discount_total: 0,
}

function ymd(date: Date) {
  return date.toISOString().slice(0, 10)
}

function dayRange(date: Date) {
  return {
    from: `${ymd(date)}T00:00:00Z`,
    to: `${ymd(date)}T23:59:59Z`,
    shift_id: null,
  }
}

function dayLabel(date: Date) {
  return ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][date.getDay()]
}

function lastSevenDays(today: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))
    return date
  })
}

export default function Home() {
  const [summary, setSummary] = useState<SalesSummary>(emptySummary)
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [openOrders, setOpenOrders] = useState<Order[]>([])
  const [tableStatuses, setTableStatuses] = useState<TableStatus[]>([])
  const [shift, setShift] = useState<Shift | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const today = new Date()
    const days = lastSevenDays(today)

    async function loadDashboard() {
      setLoading(true)
      setError(null)
      try {
        const [todaySummary, nextOrders, nextTables, currentShift, weeklySummaries] =
          await Promise.all([
            reportSalesSummary(dayRange(today)),
            listOpenOrders(),
            listTableStatus(),
            getCurrentShift(),
            Promise.all(days.map((date) => reportSalesSummary(dayRange(date)))),
          ])

        if (!active) return

        setSummary(todaySummary)
        setOpenOrders(nextOrders)
        setTableStatuses(nextTables)
        setShift(currentShift)
        setChartData(
          days.map((date, index) => ({
            day: dayLabel(date),
            revenue: weeklySummaries[index]?.revenue ?? 0,
          })),
        )
      } catch (e) {
        if (active) setError(String(e))
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadDashboard()

    return () => {
      active = false
    }
  }, [])

  const freeTables = useMemo(
    () => tableStatuses.filter((status) => status.status === "TRONG" && status.table.is_active),
    [tableStatuses],
  )

  const tableNamesById = useMemo(() => {
    const entries = tableStatuses.map((status) => [status.table.id, status.table.name] as const)
    return new Map(entries)
  }, [tableStatuses])

  return (
    <div className="grid gap-6 p-6 xl:grid-cols-[1fr_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        {error && (
          <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </p>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Doanh thu hôm nay" value={formatVnd(summary.revenue)} tone="green" />
          <MetricCard label="Đơn hôm nay" value={String(summary.order_count)} tone="green" />
          <MetricCard label="Đang xử lý" value={String(openOrders.length)} tone="gold" />
          <MetricCard label="TB/đơn" value={formatVnd(summary.avg_order_value)} tone="brown" />
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold">Doanh thu 7 ngày</h2>
              <p className="text-sm text-muted-foreground">
                {shift ? "Ca đang mở" : "Chưa mở ca"} · Dữ liệu từ đơn đã thanh toán
              </p>
            </div>
            <Pill tone="brown">VND</Pill>
          </div>
          <div className="h-56">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Đang tải biểu đồ...
              </div>
            ) : (
              <ResponsiveContainer height="100%" width="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="weeklyRevenue" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#6F4E37" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6F4E37" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#E7E5E4" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(value) => formatVnd(Number(value))} />
                  <Area
                    dataKey="revenue"
                    fill="url(#weeklyRevenue)"
                    stroke="#6F4E37"
                    strokeWidth={3}
                    type="monotone"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold">Đơn đang xử lý</h2>
            <Pill tone="gold">{openOrders.length} đơn</Pill>
          </div>
          <div className="divide-y">
            {openOrders.map((order) => {
              const location =
                order.order_type === "DINE_IN"
                  ? (tableNamesById.get(order.table_id ?? 0) ?? "Tại bàn")
                  : "Mang đi"
              return (
                <Link
                  aria-label={`Mở đơn ${order.code}`}
                  className="flex min-h-16 items-center justify-between gap-4 py-3 transition hover:text-primary"
                  key={order.id}
                  to={`/payment/${order.id}`}
                >
                  <div className="min-w-0">
                    <p className="font-bold">{order.code}</p>
                    <p className="text-sm text-muted-foreground">
                      {location} · {order.items.length} món
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-extrabold text-primary">{formatVnd(order.total)}</span>
                    <Pill tone="gold">Đang pha</Pill>
                  </div>
                </Link>
              )
            })}
            {openOrders.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Chưa có đơn đang xử lý
              </p>
            )}
          </div>
        </section>
      </div>

      <aside className="flex min-w-0 flex-col gap-6">
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="text-lg font-extrabold">Bàn trống</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {freeTables.slice(0, 12).map((status) => (
              <Link
                className="grid min-h-12 place-items-center rounded-2xl bg-[#F3EDEA] px-2 text-center font-bold text-primary transition hover:bg-primary hover:text-primary-foreground"
                key={status.table.id}
                to={`/sales?tableId=${status.table.id}`}
              >
                {status.table.name}
              </Link>
            ))}
          </div>
          {freeTables.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">Hết bàn trống</p>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-extrabold">Sắp hết hàng</h3>
            <Pill tone="red">M10</Pill>
          </div>
          {/* TODO(M10): noi API low-stock khi module kho duoc trien khai. */}
          <p className="mt-4 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
            Chưa bật quản lý kho (M10)
          </p>
        </section>
      </aside>
    </div>
  )
}

function MetricCard({
  label,
  tone,
  value,
}: {
  label: string
  tone: "brown" | "gold" | "green"
  value: string
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-extrabold">{value}</p>
      <div className="mt-3">
        <Pill tone={tone}>{label === "Đang xử lý" ? "bếp/bar" : "hôm nay"}</Pill>
      </div>
    </section>
  )
}

function Pill({
  children,
  tone,
}: {
  children: ReactNode
  tone: "brown" | "gold" | "green" | "red"
}) {
  const classes = {
    brown: "bg-[#F3EDEA] text-primary",
    gold: "bg-[#FFF5DF] text-[#9A6115]",
    green: "bg-[#E9F7F0] text-[#167A50]",
    red: "bg-[#FCEAEA] text-[#B22D29]",
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${classes[tone]}`}
    >
      {children}
    </span>
  )
}
