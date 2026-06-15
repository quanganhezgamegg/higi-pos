import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Plus, Receipt, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { DEFAULT_ICE_LEVELS, DEFAULT_SUGAR_LEVELS } from "@/lib/constants"
import { formatVnd } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  listCategories,
  listProducts,
  listToppings,
  type Category,
  type Product,
  type ProductSize,
  type Topping,
} from "@/lib/api/menu"
import {
  createOrder,
  addOrderItem,
  listOpenOrders,
  type Order,
  type OrderItemInput,
  type OrderType,
} from "@/lib/api/orders"
import { getCurrentShift, type Shift } from "@/lib/api/shifts"
import { listTableStatus, type TableStatus } from "@/lib/api/tables"

type CartItem = OrderItemInput & {
  key: string
}

function calcLine(item: OrderItemInput) {
  const toppings = item.toppings.reduce((sum, topping) => sum + topping.price * topping.quantity, 0)
  return Math.max(0, (item.unit_price + toppings) * item.quantity - item.line_discount)
}

export default function Sales() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedTableId = Number(searchParams.get("tableId")) || null
  const [shift, setShift] = useState<Shift | null | undefined>(undefined)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [toppings, setToppings] = useState<Topping[]>([])
  const [tables, setTables] = useState<TableStatus[]>([])
  const [openOrders, setOpenOrders] = useState<Order[]>([])
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderType, setOrderType] = useState<OrderType>(requestedTableId ? "DINE_IN" : "TAKEAWAY")
  const [tableId, setTableId] = useState<number | null>(requestedTableId)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setError(null)
    try {
      const [currentShift, nextCategories, nextProducts, nextToppings, nextTables, nextOrders] =
        await Promise.all([
          getCurrentShift(),
          listCategories(false),
          listProducts(null, false),
          listToppings(false),
          listTableStatus(),
          listOpenOrders(),
        ])
      setShift(currentShift)
      setCategories(nextCategories)
      setProducts(nextProducts)
      setToppings(nextToppings)
      setTables(nextTables)
      setOpenOrders(nextOrders)
      setCategoryId((current) => current ?? nextCategories[0]?.id ?? null)
    } catch (e) {
      setError(String(e))
      setShift(null)
    }
  }

  useEffect(() => {
    Promise.all([
      getCurrentShift(),
      listCategories(false),
      listProducts(null, false),
      listToppings(false),
      listTableStatus(),
      listOpenOrders(),
    ])
      .then(
        ([currentShift, nextCategories, nextProducts, nextToppings, nextTables, nextOrders]) => {
          setShift(currentShift)
          setCategories(nextCategories)
          setProducts(nextProducts)
          setToppings(nextToppings)
          setTables(nextTables)
          setOpenOrders(nextOrders)
          setCategoryId(nextCategories[0]?.id ?? null)
        },
      )
      .catch((e) => {
        setError(String(e))
        setShift(null)
      })
  }, [])

  const visibleProducts = useMemo(
    () => products.filter((product) => categoryId === null || product.category_id === categoryId),
    [products, categoryId],
  )
  const freeTables = tables.filter((status) => status.status === "TRONG")
  const subtotal = cart.reduce((sum, item) => sum + calcLine(item), 0)

  async function submitOrder() {
    setError(null)
    if (cart.length === 0) {
      setError("Giỏ hàng đang trống")
      return
    }
    if (orderType === "DINE_IN" && tableId === null) {
      setError("Vui lòng chọn bàn")
      return
    }
    setLoading(true)
    try {
      let order = await createOrder({ order_type: orderType, table_id: tableId, note: null })
      for (const item of cart) {
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
      setCart([])
      setTableId(null)
      await refresh()
      navigate(`/payment/${order.id}`)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  if (shift === undefined) {
    return <div className="p-6 text-muted-foreground">Đang kiểm tra ca...</div>
  }

  if (shift === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Chưa mở ca làm việc</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Bạn cần mở ca trước khi bắt đầu bán hàng để đơn được gắn đúng ca đối soát.
        </p>
        <Button asChild className="h-12 px-6">
          <Link to="/shift">Mở ca ngay</Link>
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-muted/20">
      <header className="flex items-center justify-between border-b bg-background px-4 py-3">
        <div>
          <h1 className="text-xl font-bold">Bán hàng</h1>
          <p className="text-xs text-muted-foreground">
            Ca mở lúc {new Date(shift.opened_at).toLocaleString("vi-VN")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/">Trang chủ</Link>
          </Button>
          <Button variant="outline" onClick={refresh}>
            Tải lại
          </Button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[1fr_380px] gap-0">
        <section className="flex min-w-0 flex-col">
          <div className="flex gap-2 overflow-x-auto border-b bg-background px-3 py-2">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={categoryId === category.id ? "default" : "outline"}
                className="h-11 shrink-0"
                onClick={() => setCategoryId(category.id)}
              >
                {category.name}
              </Button>
            ))}
          </div>
          <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto p-3 lg:grid-cols-3 xl:grid-cols-4">
            {visibleProducts.map((product) => (
              <button
                key={product.id}
                className="flex min-h-[128px] flex-col justify-between rounded-lg border bg-background p-3 text-left shadow-sm transition hover:border-primary"
                onClick={() => setSelectedProduct(product)}
              >
                <div>
                  <p className="line-clamp-2 font-semibold">{product.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {product.sizes.length > 1 ? "Có chọn size" : "Size M"}
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="font-bold">{formatVnd(product.base_price)}</span>
                  <Plus className="size-5 text-primary" />
                </div>
              </button>
            ))}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col border-l bg-background">
          <div className="border-b p-3">
            <div className="grid grid-cols-2 gap-2">
              {(["TAKEAWAY", "DINE_IN"] as OrderType[]).map((type) => (
                <Button
                  key={type}
                  variant={orderType === type ? "default" : "outline"}
                  className="h-11"
                  onClick={() => {
                    setOrderType(type)
                    if (type === "TAKEAWAY") setTableId(null)
                  }}
                >
                  {type === "TAKEAWAY" ? "Mang về" : "Tại bàn"}
                </Button>
              ))}
            </div>
            {orderType === "DINE_IN" && (
              <select
                className="mt-2 h-11 w-full rounded-md border bg-background px-3"
                value={tableId ?? ""}
                onChange={(event) => setTableId(Number(event.target.value) || null)}
              >
                <option value="">Chọn bàn trống</option>
                {freeTables.map((status) => (
                  <option key={status.table.id} value={status.table.id}>
                    {status.table.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {cart.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Chưa có món nào</p>
            ) : (
              <div className="flex flex-col gap-2">
                {cart.map((item) => (
                  <div key={item.key} className="rounded-lg border p-3">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.product_name}</p>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCart((items) => items.filter((x) => x.key !== item.key))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            setCart((items) =>
                              items.map((x) =>
                                x.key === item.key
                                  ? { ...x, quantity: Math.max(1, x.quantity - 1) }
                                  : x,
                              ),
                            )
                          }
                        >
                          -
                        </Button>
                        <span className="w-8 text-center font-semibold">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            setCart((items) =>
                              items.map((x) =>
                                x.key === item.key ? { ...x, quantity: x.quantity + 1 } : x,
                              ),
                            )
                          }
                        >
                          +
                        </Button>
                      </div>
                      <span className="font-bold">{formatVnd(calcLine(item))}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tạm tính</span>
              <span className="text-xl font-bold">{formatVnd(subtotal)}</span>
            </div>
            {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
            <Button
              className="h-12 w-full text-base"
              disabled={loading || cart.length === 0}
              onClick={submitOrder}
            >
              {loading ? "Đang tạo..." : "Tạo đơn & thanh toán"}
            </Button>
            {openOrders.length > 0 && (
              <div className="mt-3 border-t pt-3">
                <p className="mb-2 text-sm font-medium">Đơn đang mở</p>
                <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
                  {openOrders.map((order) => (
                    <Button
                      key={order.id}
                      variant="outline"
                      className="justify-between"
                      onClick={() => navigate(`/payment/${order.id}`)}
                    >
                      <span>{order.code}</span>
                      <span className="inline-flex items-center gap-1">
                        <Receipt className="size-4" />
                        {formatVnd(order.total)}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </main>

      {selectedProduct && (
        <OptionDialog
          product={selectedProduct}
          toppings={toppings}
          onClose={() => setSelectedProduct(null)}
          onAdd={(item) => {
            setCart((items) => [...items, { ...item, key: crypto.randomUUID() }])
            setSelectedProduct(null)
          }}
        />
      )}
    </div>
  )
}

function OptionDialog({
  product,
  toppings,
  onClose,
  onAdd,
}: {
  product: Product
  toppings: Topping[]
  onClose: () => void
  onAdd: (item: OrderItemInput) => void
}) {
  const defaultSize = product.sizes.find((size) => size.is_default) ?? product.sizes[0]
  const [size, setSize] = useState<ProductSize | undefined>(defaultSize)
  const [sugar, setSugar] = useState(DEFAULT_SUGAR_LEVELS[2])
  const [ice, setIce] = useState(DEFAULT_ICE_LEVELS[2])
  const [qty, setQty] = useState(1)
  const [selectedToppings, setSelectedToppings] = useState<Topping[]>([])
  const [note, setNote] = useState("")

  const unitPrice = product.base_price + (size?.price_delta ?? 0)
  const item: OrderItemInput = {
    product_id: product.id,
    product_name: product.name,
    size_name: size?.name ?? null,
    unit_price: unitPrice,
    quantity: qty,
    sugar_level: sugar,
    ice_level: ice,
    line_note: note.trim() || null,
    line_discount: 0,
    toppings: selectedToppings.map((topping) => ({
      topping_id: topping.id,
      topping_name: topping.name,
      price: topping.price,
      quantity: 1,
    })),
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <OptionGroup label="Size">
            {product.sizes.map((nextSize) => (
              <Button
                key={nextSize.id}
                variant={size?.id === nextSize.id ? "default" : "outline"}
                className="h-11"
                onClick={() => setSize(nextSize)}
              >
                {nextSize.name}{" "}
                {nextSize.price_delta > 0 ? `+${formatVnd(nextSize.price_delta)}` : ""}
              </Button>
            ))}
          </OptionGroup>
          <OptionGroup label="Đường">
            {DEFAULT_SUGAR_LEVELS.map((level) => (
              <Button
                key={level}
                variant={sugar === level ? "default" : "outline"}
                onClick={() => setSugar(level)}
              >
                {level}
              </Button>
            ))}
          </OptionGroup>
          <OptionGroup label="Đá">
            {DEFAULT_ICE_LEVELS.map((level) => (
              <Button
                key={level}
                variant={ice === level ? "default" : "outline"}
                onClick={() => setIce(level)}
              >
                {level}
              </Button>
            ))}
          </OptionGroup>
          <OptionGroup label="Topping">
            {toppings.map((topping) => {
              const active = selectedToppings.some((item) => item.id === topping.id)
              return (
                <Button
                  key={topping.id}
                  variant={active ? "default" : "outline"}
                  onClick={() =>
                    setSelectedToppings((items) =>
                      active ? items.filter((item) => item.id !== topping.id) : [...items, topping],
                    )
                  }
                >
                  {topping.name} +{formatVnd(topping.price)}
                </Button>
              )
            })}
          </OptionGroup>
          <div>
            <p className="mb-2 text-sm font-medium">Ghi chú</p>
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ít ngọt, không đá..."
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQty((value) => Math.max(1, value - 1))}
              >
                -
              </Button>
              <span className="w-10 text-center text-lg font-bold">{qty}</span>
              <Button variant="outline" size="icon" onClick={() => setQty((value) => value + 1)}>
                +
              </Button>
            </div>
            <span className="text-lg font-bold">{formatVnd(calcLine(item))}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={() => onAdd(item)}>Thêm vào giỏ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OptionGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className={cn("flex flex-wrap gap-2")}>{children}</div>
    </div>
  )
}
