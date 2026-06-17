import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  listCategories,
  listProducts,
  listToppings,
  type Category,
  type Product,
  type Topping,
} from "@/lib/api/menu"
import { listOpenOrders, type Order, type OrderType } from "@/lib/api/orders"
import { getCurrentShift, type Shift } from "@/lib/api/shifts"
import { listTableStatus, type TableStatus } from "@/lib/api/tables"
import { CartPanel } from "@/routes/sales/CartPanel"
import { CategoryPane } from "@/routes/sales/CategoryPane"
import { OptionDialog } from "@/routes/sales/OptionDialog"
import { ProductGrid } from "@/routes/sales/ProductGrid"
import { TopBar } from "@/routes/sales/TopBar"
import { useCartStore } from "@/store/cartStore"

export default function Sales() {
  const [searchParams] = useSearchParams()
  const requestedTableId = Number(searchParams.get("tableId")) || null

  const [shift, setShift] = useState<Shift | null | undefined>(undefined)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [toppings, setToppings] = useState<Topping[]>([])
  const [tables, setTables] = useState<TableStatus[]>([])
  const [openOrders, setOpenOrders] = useState<Order[]>([])

  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [dialogProduct, setDialogProduct] = useState<Product | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [orderType, setOrderType] = useState<OrderType>(requestedTableId ? "DINE_IN" : "TAKEAWAY")
  const [searchQuery, setSearchQuery] = useState("")
  const [tableId, setTableId] = useState<number | null>(requestedTableId)
  const [debouncedQuery, setDebouncedQuery] = useState("")

  const addItem = useCartStore((state) => state.addItem)

  async function loadAll() {
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
    let active = true

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
          if (!active) return
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
        if (!active) return
        setError(String(e))
        setShift(null)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(searchQuery), 150)
    return () => window.clearTimeout(timeout)
  }, [searchQuery])

  const visibleProducts = useMemo(() => {
    const query = debouncedQuery.trim().toLowerCase()
    if (query) {
      return products.filter((product) => product.name.toLowerCase().includes(query))
    }
    return products.filter((product) => categoryId === null || product.category_id === categoryId)
  }, [categoryId, debouncedQuery, products])

  const freeTables = useMemo(
    () => tables.filter((status) => status.status === "TRONG" && status.table.is_active),
    [tables],
  )
  const selectedTableName =
    tables.find((status) => status.table.id === tableId)?.table.name ??
    freeTables.find((status) => status.table.id === tableId)?.table.name ??
    null

  if (shift === undefined) {
    return <div className="p-6 text-muted-foreground">Đang kiểm tra ca...</div>
  }

  if (shift === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h1 className="text-2xl font-bold">Chưa mở ca làm việc</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Bạn cần mở ca trước khi bắt đầu bán hàng để đơn được gắn đúng ca đối soát.
        </p>
        <Button asChild className="h-12 rounded-2xl px-6">
          <Link to="/shift">Mở ca ngay</Link>
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted">
      <TopBar
        freeTables={freeTables}
        orderType={orderType}
        searchQuery={searchQuery}
        shift={shift}
        tableId={tableId}
        onOrderTypeChange={setOrderType}
        onSearchChange={setSearchQuery}
        onTableChange={setTableId}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <CategoryPane
          activeCategoryId={debouncedQuery ? null : categoryId}
          categories={categories}
          onSelect={(id) => {
            setCategoryId(id)
            setSearchQuery("")
          }}
        />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <ProductGrid
            products={visibleProducts}
            toppings={toppings}
            onOpenDialog={setDialogProduct}
          />
        </main>

        <CartPanel
          error={error}
          loading={loading}
          openOrders={openOrders}
          orderType={orderType}
          tableId={tableId}
          tableName={selectedTableName}
          onError={setError}
          onLoadingChange={setLoading}
          onSubmitSuccess={() => loadAll()}
        />
      </div>

      {dialogProduct && (
        <OptionDialog
          product={dialogProduct}
          toppings={toppings}
          onClose={() => setDialogProduct(null)}
          onAdd={(item) => {
            addItem(item)
            setDialogProduct(null)
          }}
        />
      )}
    </div>
  )
}
