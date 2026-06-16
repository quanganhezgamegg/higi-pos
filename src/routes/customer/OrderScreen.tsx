import type { Branding } from "@/lib/api/branding"
import type { CustomerOrderView } from "@/lib/api/customer"
import { formatVnd } from "@/lib/format"
import BrandLogo from "@/routes/customer/BrandLogo"

type Props = {
  order: CustomerOrderView
  branding: Branding
}

export default function OrderScreen({ order, branding }: Props) {
  const locationLabel = order.table_name ?? (order.type === "TAKEAWAY" ? "Mang di" : "")

  return (
    <main className="flex h-full w-full flex-col bg-white">
      <header className="flex h-24 shrink-0 items-center justify-between bg-[var(--brand)] px-10 text-white">
        <div className="flex min-w-0 items-center gap-4">
          <BrandLogo
            branding={branding}
            className="size-14 shrink-0 bg-white text-xl text-[var(--brand)]"
          />
          <h1 className="truncate text-4xl font-bold tracking-normal">{branding.shop_name}</h1>
        </div>
        <div className="text-right text-3xl font-semibold">{locationLabel}</div>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto px-10 py-8">
        <div className="space-y-6">
          {order.items.map((item, index) => (
            <div key={`${item.name}-${index}`} className="border-b pb-5">
              <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-8 text-3xl">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-950">{item.name}</div>
                  <div className="mt-1 text-xl text-slate-500">
                    {[item.size, item.sugar, item.ice].filter(Boolean).join(" - ")}
                  </div>
                </div>
                <div className="font-semibold text-slate-700">x{item.qty}</div>
                <div className="min-w-44 text-right font-bold text-slate-950">
                  {formatVnd(item.line_total)}
                </div>
              </div>
              {item.toppings.length > 0 && (
                <div className="mt-3 space-y-1 pl-6 text-xl text-slate-500">
                  {item.toppings.map((topping, toppingIndex) => (
                    <div
                      key={`${topping.name}-${toppingIndex}`}
                      className="flex justify-between gap-8"
                    >
                      <span>+ {topping.name}</span>
                      <span>{formatVnd(topping.price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <footer className="flex h-28 shrink-0 items-center justify-between border-t-4 border-[var(--brand)] px-10">
        <div className="text-3xl font-bold text-slate-700">TONG CONG</div>
        <div className="text-6xl font-bold tracking-normal text-[var(--brand)]">
          {formatVnd(order.total)}
        </div>
      </footer>
    </main>
  )
}
