import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatVnd } from "@/lib/format"
import {
  reportPaymentMix,
  reportSalesSummary,
  reportTopProducts,
  type PaymentMixRow,
  type SalesSummary,
  type TopProductRow,
} from "@/lib/api/reports"

export default function Reports() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [summary, setSummary] = useState<SalesSummary | null>(null)
  const [paymentMix, setPaymentMix] = useState<PaymentMixRow[]>([])
  const [topProducts, setTopProducts] = useState<TopProductRow[]>([])
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    const payload = {
      from: from ? `${from}T00:00:00Z` : null,
      to: to ? `${to}T23:59:59Z` : null,
      shift_id: null,
    }
    try {
      const [nextSummary, nextMix, nextTop] = await Promise.all([
        reportSalesSummary(payload),
        reportPaymentMix(payload),
        reportTopProducts(payload, 10),
      ])
      setSummary(nextSummary)
      setPaymentMix(nextMix)
      setTopProducts(nextTop)
    } catch (e) {
      setError(String(e))
    }
  }

  useEffect(() => {
    const payload = { from: null, to: null, shift_id: null }
    Promise.all([
      reportSalesSummary(payload),
      reportPaymentMix(payload),
      reportTopProducts(payload, 10),
    ])
      .then(([nextSummary, nextMix, nextTop]) => {
        setSummary(nextSummary)
        setPaymentMix(nextMix)
        setTopProducts(nextTop)
      })
      .catch((e) => setError(String(e)))
  }, [])

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Báo cáo doanh thu</h1>
          <p className="text-sm text-muted-foreground">Tổng hợp từ các đơn đã thanh toán.</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/">Trang chủ</Link>
        </Button>
      </header>

      <section className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-lg border bg-background p-4">
        <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <Button onClick={load}>Lọc</Button>
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {summary && (
        <section className="grid grid-cols-4 gap-3">
          <Metric label="Doanh thu" value={formatVnd(summary.revenue)} />
          <Metric label="Số đơn" value={String(summary.order_count)} />
          <Metric label="Trung bình đơn" value={formatVnd(summary.avg_order_value)} />
          <Metric label="Giảm giá" value={formatVnd(summary.discount_total)} />
        </section>
      )}

      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-background p-4">
          <h2 className="mb-3 font-semibold">Phương thức thanh toán</h2>
          <div className="divide-y">
            {paymentMix.map((row) => (
              <div key={row.method} className="flex justify-between py-2">
                <span>{row.method === "CASH" ? "Tiền mặt" : "QR"}</span>
                <span className="font-medium">
                  {formatVnd(row.total)} ({row.count})
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <h2 className="mb-3 font-semibold">Món bán chạy</h2>
          <div className="divide-y">
            {topProducts.map((row) => (
              <div key={row.product_name} className="flex justify-between gap-4 py-2">
                <span className="truncate">{row.product_name}</span>
                <span className="shrink-0 font-medium">
                  {row.quantity} - {formatVnd(row.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  )
}
