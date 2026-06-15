/* @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import TableCard from "@/routes/tables/TableCard"

const table = {
  id: 1,
  area_id: 1,
  name: "Ban 1",
  seats: 2,
  sort_order: 1,
  is_active: true,
}

describe("TableCard workflow action", () => {
  it("shows a primary action for an empty active table", () => {
    const onOpen = vi.fn()

    render(
      <TableCard
        table={table}
        status="TRONG"
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onOpen={onOpen}
        onToggleActive={vi.fn()}
      />,
    )

    const openButton = screen.getByRole("button", { name: /ban tai ban/i })
    expect(openButton).toBeEnabled()

    fireEvent.click(openButton)

    expect(onOpen).toHaveBeenCalledWith(table)
  })
})
