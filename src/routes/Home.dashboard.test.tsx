import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Order } from "@/lib/api/orders"
import type { TableStatus } from "@/lib/api/tables"
import { reportSalesSummary } from "@/lib/api/reports"
import { listOpenOrders } from "@/lib/api/orders"
import { getCurrentShift } from "@/lib/api/shifts"
import { listTableStatus } from "@/lib/api/tables"
import Home from "@/routes/Home"

vi.mock("@/lib/api/reports", () => ({
  reportSalesSummary: vi.fn(),
}))

vi.mock("@/lib/api/orders", () => ({
  listOpenOrders: vi.fn(),
}))

vi.mock("@/lib/api/tables", () => ({
  listTableStatus: vi.fn(),
}))

vi.mock("@/lib/api/shifts", () => ({
  getCurrentShift: vi.fn(),
}))

vi.mock("recharts", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  return {
    Area: () => <div data-testid="weekly-revenue-area" />,
    AreaChart: Container,
    CartesianGrid: () => null,
    ResponsiveContainer: Container,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  }
})

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 7,
    code: "ORD-7",
    order_type: "DINE_IN",
    table_id: 1,
    shift_id: 2,
    status: "OPEN",
    subtotal: 125_000,
    discount_total: 0,
    total: 125_000,
    note: null,
    created_at: "2026-06-17T01:00:00Z",
    paid_at: null,
    items: [
      {
        id: 1,
        order_id: 7,
        product_id: 1,
        product_name: "Cà phê sữa",
        size_name: "M",
        unit_price: 45_000,
        quantity: 1,
        sugar_level: "70%",
        ice_level: "Vừa",
        line_note: null,
        line_discount: 0,
        line_total: 45_000,
        toppings: [],
      },
    ],
    discounts: [],
    payments: [],
    ...overrides,
  }
}

function makeTableStatus(overrides: Partial<TableStatus> = {}): TableStatus {
  return {
    table: {
      id: 1,
      area_id: 1,
      name: "A1",
      seats: 2,
      sort_order: 0,
      is_active: true,
    },
    status: "TRONG",
    open_order_id: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.setSystemTime(new Date("2026-06-17T01:00:00.000Z"))
  vi.mocked(reportSalesSummary).mockReset()
  vi.mocked(reportSalesSummary).mockResolvedValue({
    revenue: 125_000,
    order_count: 3,
    avg_order_value: 41_666,
    discount_total: 5_000,
  })
  vi.mocked(listOpenOrders).mockResolvedValue([makeOrder()])
  vi.mocked(listTableStatus).mockResolvedValue([makeTableStatus()])
  vi.mocked(getCurrentShift).mockResolvedValue({
    id: 2,
    opened_at: "2026-06-17T00:30:00Z",
    closed_at: null,
    opening_cash: 500_000,
    expected_cash: null,
    closing_cash_counted: null,
    cash_diff: null,
    total_sales: null,
    status: "OPEN",
    note: null,
  })
})

describe("Home dashboard", () => {
  it("renders operational KPI cards from existing APIs", async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(await screen.findByText("Doanh thu hôm nay")).toBeInTheDocument()
    expect(screen.getAllByText("125.000 ₫").length).toBeGreaterThan(0)
    expect(screen.getByText("Đơn hôm nay")).toBeInTheDocument()
    expect(screen.getByText("Đang xử lý")).toBeInTheDocument()
    expect(screen.getByText("ORD-7")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /A1/i })).toHaveAttribute("href", "/sales?tableId=1")
    expect(screen.getByText("Chưa bật quản lý kho (M10)")).toBeInTheDocument()

    await waitFor(() =>
      expect(reportSalesSummary).toHaveBeenCalledWith({
        from: "2026-06-17T00:00:00Z",
        to: "2026-06-17T23:59:59Z",
        shift_id: null,
      }),
    )
  })
})
