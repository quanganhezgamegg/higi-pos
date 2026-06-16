import type { Branding } from "@/lib/api/branding"
import type { CustomerOrderView, CustomerPaymentView } from "@/lib/api/customer"
import { formatVnd } from "@/lib/format"
import BrandLogo from "@/routes/customer/BrandLogo"

type Props = {
  order: CustomerOrderView
  payment: CustomerPaymentView | null
  branding: Branding
}

export default function PaymentScreen({ order, payment, branding }: Props) {
  return (
    <main className="flex h-full w-full flex-col bg-white">
      <header className="flex h-24 shrink-0 items-center gap-4 bg-[var(--brand)] px-10 text-white">
        <BrandLogo
          branding={branding}
          className="size-14 shrink-0 bg-white text-xl text-[var(--brand)]"
        />
        <h1 className="truncate text-4xl font-bold tracking-normal">{branding.shop_name}</h1>
      </header>

      <section className="grid min-h-0 flex-1 grid-cols-[420px_1fr] items-center gap-12 px-12 py-10">
        <div className="flex aspect-square w-full items-center justify-center border-4 border-[var(--brand)] bg-white p-8">
          {payment ? (
            <div
              className="h-full w-full [&_svg]:h-full [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: payment.qr_svg }}
            />
          ) : (
            <div className="text-3xl font-semibold text-slate-500">Dang tai QR...</div>
          )}
        </div>

        <div className="space-y-8">
          <div>
            <div className="text-2xl font-semibold text-slate-500">TONG TIEN</div>
            <div className="mt-2 text-7xl font-bold tracking-normal text-[var(--brand)]">
              {formatVnd(payment?.amount ?? order.total)}
            </div>
          </div>
          {payment && (
            <div className="space-y-4 text-3xl text-slate-800">
              <div className="font-bold">{payment.bank_name}</div>
              <div>{payment.account_number}</div>
              <div className="text-2xl text-slate-500">Noi dung: {payment.content}</div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
