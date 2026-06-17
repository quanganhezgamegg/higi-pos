import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { NavRail } from "@/components/layout/NavRail"

describe("NavRail", () => {
  it("highlights the current route and keeps future modules disabled", () => {
    render(
      <MemoryRouter initialEntries={["/sales"]}>
        <NavRail />
      </MemoryRouter>,
    )

    expect(screen.getByRole("link", { name: /Bán hàng/i })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("button", { name: /Kho/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /Khách hàng/i })).toBeDisabled()
  })
})
