import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatVnd } from "@/lib/format"
import { closeShift, getCurrentShift, openShift, type Shift } from "@/lib/api/shifts"

export default function ShiftScreen() {
  const [shift, setShift] = useState<Shift | null | undefined>(undefined)
  const [openingCash, setOpeningCash] = useState("0")
  const [closingCash, setClosingCash] = useState("0")
  const [note, setNote] = useState("")
  const [closedShift, setClosedShift] = useState<Shift | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getCurrentShift()
      .then(setShift)
      .catch((e) => {
        setError(String(e))
        setShift(null)
      })
  }, [])

  async function handleOpen() {
    setError(null)
    setLoading(true)
    try {
      const next = await openShift(Number(openingCash || 0), note.trim() || null)
      setShift(next)
      setClosedShift(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleClose() {
    if (!shift) return
    setError(null)
    setLoading(true)
    try {
      const closed = await closeShift(shift.id, {
        closing_cash_counted: Number(closingCash || 0),
        note: note.trim() || null,
      })
      setClosedShift(closed)
      setShift(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  if (shift === undefined) {
    return <div className="p-6 text-muted-foreground">Đang tải ca...</div>
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ca làm việc</h1>
          <p className="text-sm text-muted-foreground">
            Mở ca trước khi bán, đóng ca để đối soát tiền mặt.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/">Trang chủ</Link>
        </Button>
      </header>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {closedShift && (
        <section className="rounded-lg border bg-background p-4">
          <h2 className="mb-3 font-semibold">Kết quả ca vừa đóng</h2>
          <div className="grid gap-2 text-sm">
            <Row label="Doanh thu" value={formatVnd(closedShift.total_sales ?? 0)} />
            <Row label="Tiền mặt dự kiến" value={formatVnd(closedShift.expected_cash ?? 0)} />
            <Row label="Tiền thực đếm" value={formatVnd(closedShift.closing_cash_counted ?? 0)} />
            <Row label="Chênh lệch" value={formatVnd(closedShift.cash_diff ?? 0)} />
          </div>
        </section>
      )}

      {shift ? (
        <section className="grid gap-4 rounded-lg border bg-background p-4">
          <div>
            <h2 className="text-lg font-semibold">Ca đang mở</h2>
            <p className="text-sm text-muted-foreground">
              Mở lúc {new Date(shift.opened_at).toLocaleString("vi-VN")} - Tiền đầu ca{" "}
              {formatVnd(shift.opening_cash)}
            </p>
          </div>
          <label className="grid gap-2">
            <span className="text-sm font-medium">Tiền thực đếm</span>
            <Input
              className="h-12 text-right text-lg"
              type="number"
              value={closingCash}
              onChange={(event) => setClosingCash(event.target.value)}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium">Ghi chú</span>
            <Input value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <Button
            variant="destructive"
            className="h-12 text-base"
            disabled={loading}
            onClick={handleClose}
          >
            Đóng ca & đối soát
          </Button>
        </section>
      ) : (
        <section className="grid gap-4 rounded-lg border bg-background p-4">
          <h2 className="text-lg font-semibold">Mở ca mới</h2>
          <label className="grid gap-2">
            <span className="text-sm font-medium">Tiền đầu ca</span>
            <Input
              className="h-12 text-right text-lg"
              type="number"
              value={openingCash}
              onChange={(event) => setOpeningCash(event.target.value)}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium">Ghi chú</span>
            <Input value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <Button className="h-12 text-base" disabled={loading} onClick={handleOpen}>
            Mở ca
          </Button>
        </section>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
