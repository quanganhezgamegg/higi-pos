import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Banknote, Printer, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatVnd } from "@/lib/format"
import { getOrder, type Order } from "@/lib/api/orders"
import {
  addPayment,
  applyDiscount,
  finalizeOrder,
  generateBillHtml,
  listDiscounts,
  removeOrderDiscount,
  type Discount,
  type DiscountType,
  type PaymentMethod,
} from "@/lib/api/payments"

export default function Payment() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const id = Number(orderId)
  const [order, setOrder] = useState<Order | null>(null)
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [method, setMethod] = useState<PaymentMethod>("CASH")
  const [tendered, setTendered] = useState("")
  const [manualName, setManualName] = useState("Giảm giá")
  const [manualType, setManualType] = useState<DiscountType>("AMOUNT")
  const [manualValue, setManualValue] = useState("")
  const [billHtml, setBillHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([getOrder(id), listDiscounts(false)])
      .then(([nextOrder, nextDiscounts]) => {
        setOrder(nextOrder)
        setDiscounts(nextDiscounts.filter((discount) => discount.scope === "ORDER"))
        setTendered(String(nextOrder.total))
      })
      .catch((e) => setError(String(e)))
  }, [id])

  const paidTotal = useMemo(
    () => order?.payments.reduce((sum, payment) => sum + payment.amount, 0) ?? 0,
    [order],
  )
  const remaining = Math.max(0, (order?.total ?? 0) - paidTotal)
  const changeDue = Math.max(0, Number(tendered || 0) - remaining)

  async function applyPreset(discount: Discount) {
    if (!order) return
    setError(null)
    setOrder(
      await applyDiscount(order.id, {
        discount_id: discount.id,
        name: discount.name,
        type: discount.type,
        value: discount.value,
      }),
    )
  }

  async function applyManual() {
    if (!order) return
    const value = Number(manualValue)
    if (!manualName.trim() || value <= 0) {
      setError("Vui lòng nhập chiết khấu hợp lệ")
      return
    }
    setError(null)
    setOrder(
      await applyDiscount(order.id, {
        discount_id: null,
        name: manualName,
        type: manualType,
        value,
      }),
    )
    setManualValue("")
  }

  async function receivePayment() {
    if (!order) return
    setError(null)
    setLoading(true)
    try {
      const amount = remaining || order.total
      const cashTendered = method === "CASH" ? Number(tendered || 0) : null
      const updated = await addPayment(order.id, {
        method,
        amount,
        tendered: cashTendered,
        ref_note: null,
      })
      setOrder(updated)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function finalize() {
    if (!order) return
    setError(null)
    setLoading(true)
    try {
      const paid = await finalizeOrder(order.id)
      setOrder(paid)
      setBillHtml(await generateBillHtml(order.id))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  function printBill() {
    if (!billHtml) return
    const win = window.open("", "_blank", "width=420,height=680")
    if (!win) return
    win.document.write(billHtml)
    win.document.close()
    win.focus()
    win.print()
  }

  if (!order) {
    return <div className="p-6 text-muted-foreground">Đang tải đơn...</div>
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="flex items-center justify-between border-b bg-background px-5 py-3">
        <div>
          <h1 className="text-xl font-bold">Thanh toán {order.code}</h1>
          <p className="text-xs text-muted-foreground">
            {order.status === "PAID" ? "Đã hoàn tất" : "Đơn đang mở"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/sales">Bán hàng</Link>
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Quay lại
          </Button>
        </div>
      </header>

      <main className="grid flex-1 grid-cols-[1fr_420px] gap-4 p-4">
        <section className="flex flex-col gap-4">
          <div className="rounded-lg border bg-background p-4">
            <h2 className="mb-3 font-semibold">Chi tiết món</h2>
            <div className="divide-y">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium">
                      {item.product_name}{" "}
                      <span className="text-sm text-muted-foreground">x{item.quantity}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[item.size_name, item.sugar_level, item.ice_level]
                        .filter(Boolean)
                        .join(" - ")}
                    </p>
                    {item.toppings.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        + {item.toppings.map((topping) => topping.topping_name).join(", ")}
                      </p>
                    )}
                  </div>
                  <span className="font-semibold">{formatVnd(item.line_total)}</span>
                </div>
              ))}
            </div>
          </div>

          {order.status === "OPEN" && (
            <div className="rounded-lg border bg-background p-4">
              <h2 className="mb-3 font-semibold">Chiết khấu</h2>
              <div className="mb-3 flex flex-wrap gap-2">
                {discounts.map((discount) => (
                  <Button key={discount.id} variant="outline" onClick={() => applyPreset(discount)}>
                    {discount.name}{" "}
                    {discount.type === "PERCENT" ? `${discount.value}%` : formatVnd(discount.value)}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-[1fr_120px_120px_auto] gap-2">
                <Input value={manualName} onChange={(event) => setManualName(event.target.value)} />
                <select
                  className="rounded-md border bg-background px-2"
                  value={manualType}
                  onChange={(event) => setManualType(event.target.value as DiscountType)}
                >
                  <option value="AMOUNT">VND</option>
                  <option value="PERCENT">%</option>
                </select>
                <Input
                  value={manualValue}
                  type="number"
                  min={0}
                  onChange={(event) => setManualValue(event.target.value)}
                />
                <Button onClick={applyManual}>Áp dụng</Button>
              </div>
              {order.discounts.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {order.discounts.map((discount) => (
                    <div
                      key={discount.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span>{discount.name}</span>
                      <div className="flex items-center gap-2">
                        <span>-{formatVnd(discount.amount_applied)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => setOrder(await removeOrderDiscount(discount.id))}
                        >
                          Xóa
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {billHtml && (
            <div className="rounded-lg border bg-background p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Bill</h2>
                <Button onClick={printBill}>
                  <Printer className="size-4" />
                  In bill
                </Button>
              </div>
              <iframe
                title="Bill preview"
                srcDoc={billHtml}
                className="h-[520px] w-full rounded border bg-white"
              />
            </div>
          )}
        </section>

        <aside className="flex h-fit flex-col gap-4 rounded-lg border bg-background p-4">
          <div className="space-y-2">
            <Row label="Tạm tính" value={formatVnd(order.subtotal)} />
            <Row label="Giảm giá" value={`-${formatVnd(order.discount_total)}`} />
            <div className="flex justify-between border-t pt-3 text-xl font-bold">
              <span>Tổng</span>
              <span>{formatVnd(order.total)}</span>
            </div>
            <Row label="Đã nhận" value={formatVnd(paidTotal)} />
            <Row label="Còn lại" value={formatVnd(remaining)} />
          </div>

          {order.status === "OPEN" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="h-14"
                  variant={method === "CASH" ? "default" : "outline"}
                  onClick={() => setMethod("CASH")}
                >
                  <Banknote className="size-5" />
                  Tiền mặt
                </Button>
                <Button
                  className="h-14"
                  variant={method === "QR" ? "default" : "outline"}
                  onClick={() => setMethod("QR")}
                >
                  <QrCode className="size-5" />
                  QR
                </Button>
              </div>

              {method === "CASH" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Khách đưa</label>
                  <Input
                    className="h-12 text-right text-lg"
                    type="number"
                    value={tendered}
                    onChange={(event) => setTendered(event.target.value)}
                  />
                  <Row label="Tiền thừa" value={formatVnd(changeDue)} />
                </div>
              )}

              {method === "QR" && (
                <div className="rounded-lg border p-4 text-center">
                  <QrCode className="mx-auto mb-2 size-16" />
                  <p className="text-sm text-muted-foreground">
                    Xác nhận thủ công sau khi loa báo tiền
                  </p>
                  <p className="mt-2 text-2xl font-bold">{formatVnd(remaining)}</p>
                </div>
              )}

              <Button
                className="h-12 text-base"
                disabled={loading || remaining <= 0}
                onClick={receivePayment}
              >
                Đã nhận tiền
              </Button>
              <Button
                className="h-12 text-base"
                disabled={loading || paidTotal < order.total}
                onClick={finalize}
              >
                Hoàn tất đơn
              </Button>
            </>
          )}

          {order.status === "PAID" && (
            <Button
              className="h-12"
              onClick={async () => setBillHtml(await generateBillHtml(order.id))}
            >
              Xem / In bill
            </Button>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </aside>
      </main>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
