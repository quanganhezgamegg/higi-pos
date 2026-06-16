# Prompt cho Figma Make — HiGi POS UI/UX

> Dán toàn bộ khối dưới vào Figma Make. Nếu nó sinh quá nhiều một lúc, yêu cầu từng màn (bắt đầu bằng "Bán hàng" + "Dashboard"), rồi bảo nó giữ nguyên design system cho các màn sau.

---

Thiết kế giao diện một ứng dụng **POS (bán hàng tại quầy) cho quán cà phê Việt Nam tên "HiGi"**. App chạy **toàn màn hình trên máy tính bảng/PC ở quầy** (nằm ngang, ~1280×800), **offline**, do nhân viên dùng. **Toàn bộ chữ bằng tiếng Việt có dấu**, tiền tệ **VND định dạng "35.000 ₫"**. Tối ưu **cảm ứng**: nút to (≥44px), ít gõ phím, có bàn phím số khi nhập tiền.

## Hệ thống thương hiệu & màu
- **Màu chủ đạo: nâu cà phê `#6F4E37`** (tint nhạt `#F3EDEA` cho nền nhấn/chip). Dùng cho nút chính, mục đang chọn, tổng tiền.
- Trung tính: nền `#FAFAF9`, thẻ `#FFFFFF`, viền `#E7E5E4`, chữ chính `#1C1917`, chữ phụ `#78716C`.
- Ngữ nghĩa: thành công xanh lá `#22A06B`, cảnh báo/sắp hết đỏ `#B22D29`, đang xử lý vàng hổ phách `#E8A33D`.
- Chữ: sans hiện đại, dễ đọc (Be Vietnam Pro hoặc Inter). Tiêu đề đậm, **tổng tiền cỡ lớn**.
- Phong cách: bo góc 12–16px, đổ bóng nhẹ, nhiều khoảng trắng, **ấm áp + sạch + hiện đại**.

## Các màn cần tạo (đồng bộ 1 design system, có thanh nav chung)
Thanh nav trên: logo "HiGi" + menu **Trang chủ · Bán hàng · Bàn · Thực đơn · Kho · Khách hàng · Báo cáo · Cài đặt** + trạng thái ca + avatar nhân viên.

1. **Trang chủ (Dashboard):** thẻ KPI (Doanh thu hôm nay, Đơn đang xử lý, Đã thanh toán, Khách mới); danh sách đơn đang xử lý (card: mã đơn, Tại bàn/Mang đi, tên khách + avatar chữ cái, số món, tổng tiền); sidebar phải: "Bàn trống" + "Sắp hết hàng".
2. **Bán hàng (POS) — bố cục 3 cột:** trái = danh mục (Cà phê đang chọn, Trà, Đá xay, Bánh, Topping); giữa = lưới card món to (ảnh + tên + giá); phải = giỏ đơn (dòng món + size/đường/đá/topping + nút +/- số lượng, **Tổng cộng cỡ lớn**, nút **THANH TOÁN** to). Trên cùng: chọn bàn/mang đi + ô tìm món.
3. **Popup tùy chọn món:** size (S/M/L), mức đường (0/30/50/70/100%), mức đá (không/ít/vừa/nhiều), topping (kèm giá), số lượng, ghi chú.
4. **Sơ đồ bàn:** tab khu vực (Tầng 1, Sân vườn); bàn dạng card có **màu trạng thái** (trống = viền nhạt, đang phục vụ = nâu + thời gian + tổng tiền).
5. **Thanh toán:** tổng tiền lớn; chọn **Tiền mặt** (nhập tiền khách đưa → hiện tiền thối) hoặc **QR** (hiện mã VietQR + số tiền); áp khuyến mãi.
6. **Màn hình khách (customer-facing display):** 4 trạng thái — chờ (logo + tên quán + ảnh), đơn đang gọi (danh sách món + tổng live), thanh toán (QR to + tổng tiền), cảm ơn.
7. **Quản lý thực đơn:** danh mục; món (ảnh, giá gốc, size, topping); bật/tắt bán; nút thêm.
8. **Kho & nguyên liệu:** bảng nguyên liệu (tên, đơn vị, tồn kho, badge **"Sắp hết"** đỏ); tab công thức (món → định lượng nguyên liệu).
9. **Khách hàng & tích điểm:** bảng khách (avatar, tên, SĐT, **badge điểm**, tổng chi tiêu); ô tìm theo SĐT; nút thêm khách.
10. **Báo cáo:** thẻ KPI tổng + biểu đồ doanh thu theo ngày/ca + bảng **món bán chạy** + cơ cấu Tiền mặt/QR.
11. **Mở/đóng ca:** form nhập tiền đầu ca; màn đóng ca đối soát (tiền dự kiến vs đếm thực → chênh lệch).
12. **Cài đặt:** thông tin quán + logo + chọn màu thương hiệu + cấu hình mức đường/đá + nút sao lưu.

## Dữ liệu mẫu (tiếng Việt, thực tế)
Món: Cà phê sữa 35.000 ₫, Bạc xỉu 35.000 ₫, Cà phê đen 30.000 ₫, Cappuccino 45.000 ₫, Latte 50.000 ₫, Trà đào 45.000 ₫, Trà sữa trân châu 40.000 ₫, Bánh mì 25.000 ₫.
Bàn: A1–A15 (Tầng 1 / Sân vườn). Khách: Nguyễn Văn An (1.250 điểm), Trần Thị Bình (480 điểm). Topping: Trân châu +5.000 ₫.

## Tương tác
Chạm card món → thêm nhanh (mở popup tùy chọn nếu món có size/topping); +/- số lượng trên giỏ; chạm THANH TOÁN → màn thanh toán; chạm bàn → mở đơn của bàn đó.

## Cảm hứng & tông
Tham khảo **dashboard POS nhà hàng hiện đại** (thẻ KPI + cột đơn + sidebar bàn) và **màn order cà phê 3 cột nhanh** — nhưng là **bản gốc, tông nâu cà phê của HiGi**, ấm áp & chuyên nghiệp, ưu tiên rõ ràng + tốc độ cho nhân viên.
