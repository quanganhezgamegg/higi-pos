/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import Payment from "@/routes/Payment"

const mocks = vi.hoisted(() => {
  const order = {
    id: 7,
    code: "ORD-7",
    order_type: "DINE_IN",
    table_id: 1,
    shift_id: 1,
    status: "OPEN",
    subtotal: 35_000,
    discount_total: 0,
    total: 35_000,
    note: null,
    created_at: "2026-06-15T00:00:00Z",
    paid_at: null,
    items: [
      {
        id: 11,
        order_id: 7,
        product_id: 3,
        product_name: "Latte",
        size_name: "M",
        unit_price: 35_000,
        quantity: 1,
        sugar_level: "50%",
        ice_level: "Vua",
        line_note: null,
        line_discount: 0,
        line_total: 35_000,
        toppings: [],
      },
    ],
    discounts: [],
    payments: [],
  }

  return {
    order,
    getOrder: vi.fn(() => Promise.resolve(order)),
    listDiscounts: vi.fn(() => Promise.resolve([])),
    listTableStatus: vi.fn(() =>
      Promise.resolve([
        {
          table: { id: 1, area_id: 1, name: "Ban 1", seats: 2, sort_order: 1, is_active: true },
          status: "DANG_PHUC_VU",
          open_order_id: 7,
        },
        {
          table: { id: 2, area_id: 1, name: "Ban 2", seats: 2, sort_order: 2, is_active: true },
          status: "TRONG",
          open_order_id: null,
        },
      ]),
    ),
    listOpenOrders: vi.fn(() =>
      Promise.resolve([
        {
          ...order,
          id: 9,
          code: "ORD-9",
          table_id: 3,
          total: 50_000,
          items: [],
        },
      ]),
    ),
  }
})

vi.mock("@/lib/api/orders", () => ({
  getOrder: mocks.getOrder,
  updateOrderItem: vi.fn(),
  removeOrderItem: vi.fn(),
  cancelOrder: vi.fn(),
  transferTable: vi.fn(),
  mergeTables: vi.fn(),
  listOpenOrders: mocks.listOpenOrders,
}))

vi.mock("@/lib/api/payments", () => ({
  listDiscounts: mocks.listDiscounts,
  applyDiscount: vi.fn(),
  removeOrderDiscount: vi.fn(),
  addPayment: vi.fn(),
  finalizeOrder: vi.fn(),
  generateBillHtml: vi.fn(() => Promise.resolve("<p>Bill</p>")),
}))

vi.mock("@/lib/api/tables", () => ({
  listTableStatus: mocks.listTableStatus,
}))

function renderPayment() {
  return render(
    <MemoryRouter initialEntries={["/payment/7"]}>
      <Routes>
        <Route path="/payment/:orderId" element={<Payment />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("Payment workflow controls", () => {
  it("shows actionable controls for open order management", async () => {
    renderPayment()

    expect(await screen.findByText(/ORD-7/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /huy don/i })).toBeEnabled()
    expect(screen.getByRole("button", { name: /chuyen ban/i })).toBeEnabled()
    expect(screen.getByRole("button", { name: /gop vao don/i })).toBeEnabled()
    expect(screen.getByRole("button", { name: /xoa mon/i })).toBeEnabled()
  })
})
