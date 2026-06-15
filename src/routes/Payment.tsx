import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowRightLeft, Banknote, Minus, Plus, Printer, QrCode, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatVnd } from "@/lib/format"
import {
  cancelOrder,
  getOrder,
  listOpenOrders,
  mergeTables,
  removeOrderItem,
  transferTable,
  updateOrderItem,
  type Order,
  type OrderItem,
  type OrderItemInput,
} from "@/lib/api/orders"
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
import { listTableStatus, type TableStatus } from "@/lib/api/tables"

function toOrderItemInput(item: OrderItem, quantity = item.quantity): OrderItemInput {
  return {
    product_id: item.product_id,
    product_name: item.product_name,
    size_name: item.size_name,
    unit_price: item.unit_price,
    quantity,
    sugar_level: item.sugar_level,
    ice_level: item.ice_level,
    line_note: item.line_note,
    line_discount: item.line_discount,
    toppings: item.toppings.map((topping) => ({
      topping_id: topping.topping_id,
      topping_name: topping.topping_name,
      price: topping.price,
      quantity: topping.quantity,
    })),
  }
}

export default function Payment() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const id = Number(orderId)
  const [order, setOrder] = useState<Order | null>(null)
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [tables, setTables] = useState<TableStatus[]>([])
  const [openOrders, setOpenOrders] = useState<Order[]>([])
  const [method, setMethod] = useState<PaymentMethod>("CASH")
  const [tendered, setTendered] = useState("")
  const [manualName, setManualName] = useState("Giảm giá")
  const [manualType, setManualType] = useState<DiscountType>("AMOUNT")
  const [manualValue, setManualValue] = useState("")
  const [transferTableId, setTransferTableId] = useState("")
  const [mergeTargetId, setMergeTargetId] = useState("")
  const [billHtml, setBillHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const refreshPaymentData = useCallback(async () => {
    setError(null)
    const [nextOrder, nextDiscounts, nextTables, nextOpenOrders] = await Promise.all([
      getOrder(id),
      listDiscounts(false),
      listTableStatus(),
      listOpenOrders(),
    ])
    const paid = nextOrder.payments.reduce((sum, payment) => sum + payment.amount, 0)
    const remaining = Math.max(0, nextOrder.total - paid)
    const freeTableIds = new Set(
      nextTables
        .filter((status) => status.table.is_active && status.status === "TRONG")
        .map((status) => status.table.id),
    )
    const mergeTargetIds = new Set(
      nextOpenOrders.filter((item) => item.id !== id).map((item) => item.id),
    )
    const freeTableId = [...freeTableIds][0]
    const mergeTarget = [...mergeTargetIds][0]

    setOrder(nextOrder)
    setDiscounts(nextDiscounts.filter((discount) => discount.scope === "ORDER"))
    setTables(nextTables)
    setOpenOrders(nextOpenOrders.filter((item) => item.id !== id))
    setTendered(String(remaining))
    setTransferTableId((current) =>
      current && freeTableIds.has(Number(current))
        ? current
        : freeTableId
          ? String(freeTableId)
          : "",
    )
    setMergeTargetId((current) =>
      current && mergeTargetIds.has(Number(current))
        ? current
        : mergeTarget
          ? String(mergeTarget)
          : "",
    )
  }, [id])

  useEffect(() => {
    let active = true
    Promise.all([getOrder(id), listDiscounts(false), listTableStatus(), listOpenOrders()])
      .then(([nextOrder, nextDiscounts, nextTables, nextOpenOrders]) => {
        if (!active) return
        const paid = nextOrder.payments.reduce((sum, payment) => sum + payment.amount, 0)
        const nextRemaining = Math.max(0, nextOrder.total - paid)
        const freeTableIds = new Set(
          nextTables
            .filter((status) => status.table.is_active && status.status === "TRONG")
            .map((status) => status.table.id),
        )
        const mergeTargetIds = new Set(
          nextOpenOrders.filter((item) => item.id !== id).map((item) => item.id),
        )
        const freeTableId = [...freeTableIds][0]
        const mergeTarget = [...mergeTargetIds][0]

        setOrder(nextOrder)
        setDiscounts(nextDiscounts.filter((discount) => discount.scope === "ORDER"))
        setTables(nextTables)
        setOpenOrders(nextOpenOrders.filter((item) => item.id !== id))
        setTendered(String(nextRemaining))
        setTransferTableId((current) =>
          current && freeTableIds.has(Number(current))
            ? current
            : freeTableId
              ? String(freeTableId)
              : "",
        )
        setMergeTargetId((current) =>
          current && mergeTargetIds.has(Number(current))
            ? current
            : mergeTarget
              ? String(mergeTarget)
              : "",
        )
      })
      .catch((e) => {
        if (active) setError(String(e))
      })

    return () => {
      active = false
    }
  }, [id])

  const paidTotal = useMemo(
    () => order?.payments.reduce((sum, payment) => sum + payment.amount, 0) ?? 0,
    [order],
  )
  const remaining = Math.max(0, (order?.total ?? 0) - paidTotal)
  const changeDue = Math.max(0, Number(tendered || 0) - remaining)
  const freeTables = tables.filter(
    (status) =>
      status.table.is_active && status.status === "TRONG" && status.table.id !== order?.table_id,
  )
  const mergeTargets = openOrders.filter((item) => item.status === "OPEN" && item.id !== order?.id)

  async function runOrderAction(action: () => Promise<Order>, options?: { navigateTo?: string }) {
    setError(null)
    setLoading(true)
    try {
      const updated = await action()
      setOrder(updated)
      await refreshPaymentData()
      if (options?.navigateTo) navigate(options.navigateTo)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function applyPreset(discount: Discount) {
    if (!order) return
    await runOrderAction(() =>
      applyDiscount(order.id, {
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
    await runOrderAction(() =>
      applyDiscount(order.id, {
        discount_id: null,
        name: manualName,
        type: manualType,
        value,
      }),
    )
    setManualValue("")
  }

  async function removeDiscount(discountId: number) {
    await runOrderAction(() => removeOrderDiscount(discountId))
  }

  async function changeItemQuantity(item: OrderItem, nextQuantity: number) {
    if (nextQuantity < 1) {
      await deleteItem(item)
      return
    }
    await runOrderAction(() => updateOrderItem(item.id, toOrderItemInput(item, nextQuantity)))
  }

  async function deleteItem(item: OrderItem) {
    await runOrderAction(() => removeOrderItem(item.id))
  }

  async function cancelCurrentOrder() {
    if (!order) return
    if (!window.confirm("Hủy đơn hiện tại?")) return
    await runOrderAction(() => cancelOrder(order.id), { navigateTo: "/sales" })
  }

  async function transferCurrentOrder() {
    if (!order) return
    const toTableId = Number(transferTableId)
    if (!toTableId) {
      setError("Vui lòng chọn bàn trống để chuyển")
      return
    }
    await runOrderAction(() => transferTable(order.id, toTableId))
  }

  async function mergeCurrentOrder() {
    if (!order) return
    const targetOrderId = Number(mergeTargetId)
    if (!targetOrderId) {
      setError("Vui lòng chọn đơn đích để gộp")
      return
    }
    setError(null)
    setLoading(true)
    try {
      const merged = await mergeTables([order.id], targetOrderId)
      setOrder(merged)
      navigate(`/payment/${merged.id}`)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function receivePayment() {
    if (!order) return
    await runOrderAction(() =>
      addPayment(order.id, {
        method,
        amount: remaining || order.total,
        tendered: method === "CASH" ? Number(tendered || 0) : null,
        ref_note: null,
      }),
    )
  }

  async function finalize() {
    if (!order) return
    setError(null)
    setLoading(true)
    try {
      const paid = await finalizeOrder(order.id)
      setOrder(paid)
      setBillHtml(await generateBillHtml(order.id))
      await refreshPaymentData()
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function loadBill() {
    if (!order) return
    setError(null)
    try {
      setBillHtml(await generateBillHtml(order.id))
    } catch (e) {
      setError(String(e))
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
    return (
      <div className="p-6 text-muted-foreground">
        {error ? <span className="text-destructive">{error}</span> : "Đang tải đơn..."}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="flex items-center justify-between border-b bg-background px-5 py-3">
        <div>
          <h1 className="text-xl font-bold">Thanh toán {order.code}</h1>
          <p className="text-xs text-muted-foreground">
            {order.status === "PAID"
              ? "Đã hoàn tất"
              : order.status === "CANCELLED"
                ? "Đã hủy"
                : "Đơn đang mở"}
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
              {order.items.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">Đơn chưa có món.</p>
              ) : (
                order.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-4 py-3">
                    <div className="min-w-0">
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
                      {order.status === "OPEN" && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Button
                            aria-label="Giam so luong"
                            size="icon-sm"
                            variant="outline"
                            disabled={loading}
                            onClick={() => void changeItemQuantity(item, item.quantity - 1)}
                          >
                            <Minus className="size-4" />
                          </Button>
                          <span className="w-8 text-center text-sm font-semibold">
                            {item.quantity}
                          </span>
                          <Button
                            aria-label="Tang so luong"
                            size="icon-sm"
                            variant="outline"
                            disabled={loading}
                            onClick={() => void changeItemQuantity(item, item.quantity + 1)}
                          >
                            <Plus className="size-4" />
                          </Button>
                          <Button
                            aria-label="Xoa mon"
                            size="sm"
                            variant="ghost"
                            disabled={loading}
                            onClick={() => void deleteItem(item)}
                          >
                            <Trash2 className="size-4" />
                            Xóa món
                          </Button>
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 font-semibold">{formatVnd(item.line_total)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {order.status === "OPEN" && (
            <div className="rounded-lg border bg-background p-4">
              <h2 className="mb-3 font-semibold">Thao tác đơn</h2>
              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <select
                  aria-label="Bàn chuyển đến"
                  className="h-10 rounded-md border bg-background px-3"
                  value={transferTableId}
                  onChange={(event) => setTransferTableId(event.target.value)}
                >
                  <option value="">Chọn bàn trống</option>
                  {freeTables.map((status) => (
                    <option key={status.table.id} value={status.table.id}>
                      {status.table.name}
                    </option>
                  ))}
                </select>
                <Button
                  aria-label="Chuyen ban"
                  variant="outline"
                  disabled={loading || !transferTableId}
                  onClick={() => void transferCurrentOrder()}
                >
                  <ArrowRightLeft className="size-4" />
                  Chuyển bàn
                </Button>
                <select
                  aria-label="Đơn gộp đến"
                  className="h-10 rounded-md border bg-background px-3"
                  value={mergeTargetId}
                  onChange={(event) => setMergeTargetId(event.target.value)}
                >
                  <option value="">Chọn đơn đích</option>
                  {mergeTargets.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} - {formatVnd(item.total)}
                    </option>
                  ))}
                </select>
                <Button
                  aria-label="Gop vao don"
                  variant="outline"
                  disabled={loading || !mergeTargetId}
                  onClick={() => void mergeCurrentOrder()}
                >
                  Gộp vào đơn
                </Button>
              </div>
              <div className="mt-3">
                <Button
                  aria-label="Huy don"
                  variant="destructive"
                  disabled={loading}
                  onClick={() => void cancelCurrentOrder()}
                >
                  Hủy đơn
                </Button>
              </div>
            </div>
          )}

          {order.status === "OPEN" && (
            <div className="rounded-lg border bg-background p-4">
              <h2 className="mb-3 font-semibold">Chiết khấu</h2>
              <div className="mb-3 flex flex-wrap gap-2">
                {discounts.map((discount) => (
                  <Button
                    key={discount.id}
                    variant="outline"
                    disabled={loading}
                    onClick={() => void applyPreset(discount)}
                  >
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
                <Button disabled={loading} onClick={() => void applyManual()}>
                  Áp dụng
                </Button>
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
                          disabled={loading}
                          onClick={() => void removeDiscount(discount.id)}
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
                onClick={() => void receivePayment()}
              >
                Đã nhận tiền
              </Button>
              <Button
                className="h-12 text-base"
                disabled={loading || paidTotal < order.total}
                onClick={() => void finalize()}
              >
                Hoàn tất đơn
              </Button>
            </>
          )}

          {order.status === "PAID" && (
            <Button className="h-12" onClick={() => void loadBill()}>
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
