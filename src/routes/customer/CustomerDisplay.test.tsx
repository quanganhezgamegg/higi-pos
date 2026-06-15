/* @vitest-environment jsdom */

import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Branding } from "@/lib/api/branding"
import type { CustomerOrderView } from "@/lib/api/customer"
import OrderScreen from "@/routes/customer/OrderScreen"
import PaymentScreen from "@/routes/customer/PaymentScreen"
import ThankYouScreen from "@/routes/customer/ThankYouScreen"

const branding: Branding = {
  shop_name: "HiGi Test",
  shop_address: "",
  shop_phone: "",
  brand_color: "#6F4E37",
  logo_path: null,
  idle_bg_path: null,
  promo_images: [],
  customer_welcome_text: "Chao mung",
  bill_footer: "Cam on",
}

const order: CustomerOrderView = {
  code: "ORD-001",
  type: "TAKEAWAY",
  table_name: null,
  items: [
    {
      name: "Ca phe sua",
      size: "L",
      sugar: "70%",
      ice: "Vua",
      qty: 2,
      line_total: 60_000,
      toppings: [],
    },
  ],
  subtotal: 60_000,
  discount_total: 0,
  total: 60_000,
}

describe("OrderScreen", () => {
  it("renders order items and total", () => {
    render(<OrderScreen order={order} branding={branding} />)

    expect(screen.getByText(/Ca phe sua/)).toBeInTheDocument()
    expect(screen.getAllByText(/60.000/).length).toBeGreaterThan(0)
  })
})

describe("PaymentScreen", () => {
  it("renders loading state when payment QR is missing", () => {
    render(<PaymentScreen order={order} payment={null} branding={branding} />)

    expect(screen.getByText(/Dang tai QR/i)).toBeInTheDocument()
  })

  it("renders QR and bank details when payment exists", () => {
    render(
      <PaymentScreen
        order={order}
        payment={{
          qr_svg: "<svg><rect /></svg>",
          amount: 60_000,
          content: "DHORD-001",
          bank_name: "Vietcombank",
          account_number: "123456789",
        }}
        branding={branding}
      />,
    )

    expect(screen.getByText("Vietcombank")).toBeInTheDocument()
    expect(screen.getByText("123456789")).toBeInTheDocument()
  })
})

describe("ThankYouScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("calls onDone after six seconds", () => {
    const onDone = vi.fn()
    render(<ThankYouScreen branding={branding} onDone={onDone} />)

    expect(onDone).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(6_001)
    })

    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
