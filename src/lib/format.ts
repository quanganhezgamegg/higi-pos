/** Định dạng số tiền VND: nghìn ngăn bằng dấu chấm, hậu tố " ₫", làm tròn về đồng nguyên. */
export function formatVnd(amount: number): string {
  const rounded = Math.round(amount)
  return `${new Intl.NumberFormat("vi-VN").format(rounded)} ₫`
}
