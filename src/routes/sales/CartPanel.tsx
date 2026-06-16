import { Receipt, Trash2 } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { setCustomerOrder } from "@/lib/api/customer"
import {
  addOrderItem,
  createOrder,
  type Order,
  type OrderItemInput,
  type OrderType,
} from "@/lib/api/orders"
import { formatVnd } from "@/lib/format"
import { calcLine, useCartStore } from "@/store/cartStore"

type CartPanelProps = {
  orderType: OrderType
  tableId: number | null
  tableName: string | null
  openOrders: Order[]
  error: string | null
  loading: boolean
  onError: (message: string | null) => void
  onLoadingChange: (loading: boolean) => void
  onSubmitSuccess: () => void | Promise<void>
}

export function CartPanel({
  error,
  loading,
  openOrders,
  orderType,
  tableId,
  tableName,
  onError,
  onLoadingChange,
  onSubmitSuccess,
}: CartPanelProps) {
  const navigate = useNavigate()
  const { clear, items, removeItem, setQty } = useCartStore()
  const subtotal = items.reduce((sum, item) => sum + calcLine(item), 0)

  async function handleSubmit() {
    onError(null)
    if (items.length === 0) {
      onError("Giỏ hàng đang trống")
      return
    }
    if (orderType === "DINE_IN" && tableId === null) {
      onError("Vui lòng chọn bàn")
      return
    }

    onLoadingChange(true)
    try {
      let order = await createOrder({ order_type: orderType, table_id: tableId, note: null })
      await setCustomerOrder(order.id, "order")

      for (const item of items) {
        const payload: OrderItemInput = {
          product_id: item.product_id,
          product_name: item.product_name,
          size_name: item.size_name,
          unit_price: item.unit_price,
          quantity: item.quantity,
          sugar_level: item.sugar_level,
          ice_level: item.ice_level,
          line_note: item.line_note,
          line_discount: item.line_discount,
          toppings: item.toppings,
        }
        order = await addOrderItem(order.id, payload)
      }

      clear()
      await onSubmitSuccess()
      navigate(`/payment/${order.id}`)
    } catch (e) {
      onError(String(e))
    } finally {
      onLoadingChange(false)
    }
  }

  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l bg-white shadow-sm">
      <div className="shrink-0 border-b p-5">
        <h2 className="text-xl font-extrabold">
          {orderType === "DINE_IN" && tableName ? `Đơn - ${tableName}` : "Đơn mang đi"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {items.length > 0 ? `${items.length} dòng món` : "Chưa có món"}
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-4">
          {items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Chưa có món nào</p>
          ) : (
            items.map((item) => (
              <div key={item.key} className="rounded-2xl bg-stone-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{item.product_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {[item.size_name, item.sugar_level, item.ice_level]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {item.toppings.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        + {item.toppings.map((topping) => topping.topping_name).join(", ")}
                      </p>
                    )}
                  </div>
                  <Button
                    aria-label="Xóa món"
                    variant="ghost"
                    size="icon"
                    className="size-10 rounded-xl text-muted-foreground hover:text-destructive"
                    onClick={() => removeItem(item.key)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-11 rounded-xl bg-white"
                      onClick={() => setQty(item.key, item.quantity - 1)}
                    >
                      -
                    </Button>
                    <span className="w-8 text-center font-bold">{item.quantity}</span>
                    <Button
                      size="icon"
                      className="size-11 rounded-xl"
                      onClick={() => setQty(item.key, item.quantity + 1)}
                    >
                      +
                    </Button>
                  </div>
                  <span className="font-bold">{formatVnd(calcLine(item))}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {openOrders.length > 0 && (
        <div className="shrink-0 border-t px-4 py-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Đơn đang mở
          </p>
          <div className="flex max-h-32 flex-col gap-2 overflow-y-auto">
            {openOrders.map((order) => (
              <button
                key={order.id}
                className="flex min-h-11 w-full items-center justify-between rounded-xl border bg-background px-3 text-sm hover:bg-secondary"
                onClick={() => {
                  void setCustomerOrder(order.id, "payment")
                  navigate(`/payment/${order.id}`)
                }}
              >
                <span className="font-bold">{order.code}</span>
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Receipt className="size-4" />
                  {formatVnd(order.total)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="shrink-0 space-y-3 border-t p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Tạm tính</span>
          <span className="font-bold">{formatVnd(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-3xl font-extrabold">
          <span>Tổng</span>
          <span className="text-primary">{formatVnd(subtotal)}</span>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          className="min-h-16 w-full rounded-2xl text-xl font-extrabold"
          disabled={loading || items.length === 0}
          onClick={() => void handleSubmit()}
        >
          {loading ? "Đang tạo đơn..." : "THANH TOÁN"}
        </Button>
      </div>
    </aside>
  )
}
