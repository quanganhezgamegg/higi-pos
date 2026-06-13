import { describe, it, expect } from "vitest"
import { formatVnd } from "@/lib/format"

describe("formatVnd", () => {
  it("định dạng nghìn bằng dấu chấm + ₫", () => {
    expect(formatVnd(35000)).toBe("35.000 ₫")
  })

  it("làm tròn về đồng nguyên", () => {
    expect(formatVnd(35000.6)).toBe("35.001 ₫")
  })

  it("xử lý số 0", () => {
    expect(formatVnd(0)).toBe("0 ₫")
  })
})
