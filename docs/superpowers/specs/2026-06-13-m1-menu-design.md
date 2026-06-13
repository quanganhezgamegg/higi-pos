# HiGi POS — M1: Quản lý Menu — Design Spec

| | |
|---|---|
| **Milestone** | M1 — Quản lý Menu |
| **Ngày** | 2026-06-13 |
| **Trạng thái** | Chờ duyệt → lập plan (KHÔNG code ở giai đoạn này) |
| **Phụ thuộc** | M0 (nền tảng: Tauri 2 + React + Rust/SQLite + commands pattern) đã merge vào `main` |
| **Master spec** | `docs/superpowers/specs/2026-06-12-higi-pos-design.md` |

## 1. Mục tiêu & phạm vi

Cho phép chủ quán **tự quản lý thực đơn** offline: danh mục, món (giá gốc + ảnh + mô tả), size (biến thể + phụ giá), và topping (danh sách dùng chung có giá). Đây là dữ liệu nền để milestone bán hàng (M3+) sử dụng.

### Trong phạm vi M1
- CRUD **danh mục** (categories).
- CRUD **món** (products): tên, giá gốc, danh mục, mô tả, ảnh (tùy chọn), trạng thái bán.
- Quản lý **size theo món** (product_sizes): tên + phụ giá + đánh dấu mặc định, quản lý lồng trong form món.
- CRUD **topping** (toppings): tên + giá, danh sách dùng chung.
- Màn hình `/menu` (3 tab: Danh mục · Món · Topping), tối ưu cảm ứng.
- **Vô hiệu hoá** (ẩn khỏi bán) và **xoá hẳn** entity.
- Ảnh món: chọn qua hộp thoại OS, copy vào thư mục app quản lý, lưu đường dẫn.

### Ngoài phạm vi M1 (làm sau)
- Mức đường/đá (order-time attribute, cấu hình ở M7; M1 dùng mặc định cố định nếu cần).
- Topping gắn-theo-món (nhóm tùy chọn) — chỉ làm nếu sau này cần.
- Bán hàng/đơn/giỏ (M3+); báo cáo (M6).
- Guard "không cho xoá nếu đã dùng trong đơn" — thêm ở milestone có bảng `orders`/`order_items` (M3/M4).

## 2. Quyết định thiết kế (best practice)

| # | Quyết định | Lý do |
|---|---|---|
| 1 | **Ảnh món** tùy chọn: chọn file qua hộp thoại OS → copy vào `app_data_dir/images/<uuid>.<ext>` → lưu **đường dẫn tương đối** (`images/<uuid>.<ext>`) trong `products.image_path`. Không ảnh → placeholder. | Không phụ thuộc file ngoài (dễ mất/di chuyển); app tự sở hữu asset; hợp mục tiêu UI đẹp; không bắt buộc. |
| 2 | **Size = biến thể + phụ giá**, tùy chọn theo món. Món có 0..n size; nếu có size thì **đúng 1** `is_default=true`; `price_delta` (số nguyên VND, ≥ 0) cộng vào `base_price`. Món không size → bán theo `base_price`. | Mẫu modifier chuẩn POS; linh hoạt cho món có/không size. |
| 3 | **Topping global**: một danh sách dùng chung, áp cho mọi món; mỗi topping có `price`. | Đơn giản, YAGNI cho quán nhỏ; thu ngân tự chọn topping phù hợp lúc bán (M3+). |
| 4 | **Xoá**: ưu tiên **vô hiệu hoá** (`is_active=false` → ẩn khỏi POS, giữ dữ liệu + cho bật lại). Có **xoá hẳn** (M1 chưa có đơn nên xoá tự do; guard "đã dùng" thêm sau). | Best practice menu: "ngừng bán" thay vì xoá; bảo toàn khả năng khôi phục & báo cáo. |

## 3. Mô hình dữ liệu

Migration mới **`src-tauri/migrations/0002_menu.sql`** (thêm vào cuối `migrations()` trong `db/migrations.rs`). Quy ước theo M0: id `INTEGER PRIMARY KEY`, tiền là số nguyên VND, `is_active` mặc định 1, `sort_order` mặc định 0.

```sql
CREATE TABLE categories (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE products (
  id          INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name        TEXT NOT NULL,
  base_price  INTEGER NOT NULL,
  description TEXT,
  image_path  TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_products_category ON products(category_id);

CREATE TABLE product_sizes (
  id         INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  price_delta INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_sizes_product ON product_sizes(product_id);

CREATE TABLE toppings (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  price      INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
```

> `ON DELETE CASCADE` cho `product_sizes`: xoá món → xoá size con. `foreign_keys=ON` đã bật ở M0 (`db/mod.rs`).

## 4. API — Tauri commands (Rust)

Nhóm trong `src-tauri/src/commands/menu.rs`, gọi `src-tauri/src/repo/menu.rs`. Kiểu trả về `Result<T, String>` như M0. Struct (serde) trong `src-tauri/src/domain/` (hoặc cùng repo nếu nhỏ).

**Danh mục:**
- `list_categories(include_inactive: bool) -> Vec<Category>`
- `create_category(name: String, sort_order: i64) -> Category`
- `update_category(id, name, sort_order, is_active) -> Category`
- `delete_category(id) -> ()` *(chặn nếu còn `products` tham chiếu → trả lỗi gợi ý vô hiệu hoá)*

**Món** (size quản lý lồng trong payload):
- `list_products(category_id: Option<i64>, include_inactive: bool) -> Vec<ProductWithSizes>`
- `create_product(payload: ProductInput) -> ProductWithSizes`
- `update_product(id, payload: ProductInput) -> ProductWithSizes` *(thay toàn bộ sizes trong 1 transaction)*
- `set_product_active(id, is_active: bool) -> ()`
- `delete_product(id) -> ()` *(CASCADE xoá sizes)*
- `save_product_image(source_path: String) -> String` *(copy file vào `app_data_dir/images/`, trả `image_path` tương đối)*

`ProductInput { name, base_price, category_id, description?, image_path?, sort_order, sizes: Vec<SizeInput> }`; `SizeInput { name, price_delta, is_default }`.

**Topping:**
- `list_toppings(include_inactive: bool) -> Vec<Topping>`
- `create_topping(name, price, sort_order) -> Topping`
- `update_topping(id, name, price, sort_order, is_active) -> Topping`
- `delete_topping(id) -> ()`

Đăng ký tất cả vào `invoke_handler` ở `lib.rs`. FE wrapper: `src/lib/api/menu.ts`.

## 5. Quy tắc & validation (trong Rust service/repo)
- `name` bắt buộc (trim, không rỗng) cho mọi entity.
- `base_price ≥ 0`, `price_delta ≥ 0`, topping `price ≥ 0`.
- Nếu món có ≥ 1 size → **đúng 1** size `is_default=true` (service tự đảm bảo; nếu input không có default thì chọn size đầu).
- `category_id` phải tồn tại khi tạo/sửa món.
- `delete_category` bị chặn nếu còn product (kể cả inactive) → trả lỗi rõ ràng để UI gợi ý vô hiệu hoá.
- Mọi thao tác ghi nhiều bảng (product + sizes) chạy trong **transaction**.

## 6. Màn hình & UX (`/menu`)
Route `/menu` (React Router, thêm vào `App.tsx`), 3 tab dùng shadcn, tối ưu cảm ứng (nút lớn, ít gõ):

- **Tab Danh mục:** bảng danh mục (tên, thứ tự, trạng thái), nút Thêm; sửa/bật-tắt/xoá; sắp xếp bằng `sort_order`.
- **Tab Món:** lọc theo danh mục; lưới/bảng món (ảnh thumbnail/placeholder, tên, giá gốc, #size, trạng thái); Dialog thêm/sửa gồm: tên, danh mục (select), giá gốc, mô tả, **ảnh** (nút chọn file → `save_product_image`), **danh sách size** (thêm dòng: tên + phụ giá + chọn mặc định), công tắc đang bán; nút Xoá.
- **Tab Topping:** bảng topping (tên, giá, trạng thái) + CRUD.

Định dạng tiền bằng `formatVnd` (đã có từ M0). State đọc dữ liệu: gọi command qua `lib/api/menu.ts`; sau mutate thì refetch danh sách liên quan.

## 7. Test
- **Rust (`repo/menu.rs` tests, in-memory SQLite + migrations):** tạo/đọc/sửa/soft-delete + hard-delete từng entity; product CRUD kèm sizes (transaction thay sizes, đảm bảo đúng 1 default); chặn `delete_category` khi còn product; FK `category_id` không hợp lệ → lỗi; CASCADE xoá sizes khi xoá product.
- **Frontend (Vitest):** logic thuần nếu có (vd tính giá hiển thị theo size = base + delta); test validate form cơ bản (tên rỗng, giá âm) nếu tách được hàm thuần.
- Toàn bộ gate CI M0 vẫn phải xanh (lint/prettier/fmt/clippy/test).

## 8. File dự kiến (cho plan tham chiếu)
- Tạo: `src-tauri/migrations/0002_menu.sql`, `src-tauri/src/repo/menu.rs`, `src-tauri/src/commands/menu.rs`, `src-tauri/src/domain/menu.rs` (struct), `src/lib/api/menu.ts`, `src/routes/Menu.tsx` (+ component con `CategoryTab.tsx`, `ProductTab.tsx`, `ProductForm.tsx`, `ToppingTab.tsx`).
- Sửa: `db/migrations.rs` (thêm M::up 0002), `lib.rs` (mod + invoke_handler), `App.tsx` (route `/menu`), `Home.tsx` (link sang Menu). Có thể thêm plugin Tauri dialog/fs cho chọn ảnh (plan quyết định cụ thể).

## 9. Tiêu chí hoàn thành M1 (acceptance)
1. Mở `/menu`, tạo được danh mục; tạo món thuộc danh mục với giá gốc + (tùy chọn) ảnh + nhiều size; thêm topping.
2. Sửa/vô hiệu hoá/bật lại/xoá từng entity hoạt động đúng; xoá món xoá kèm size.
3. Chặn xoá danh mục còn món, báo lỗi rõ ràng.
4. Ảnh: chọn file → hiển thị thumbnail; lưu bền vững qua lần mở lại app (copy vào app data).
5. Dữ liệu bền vững trong SQLite; migration 0002 chạy sạch trên DB mới và DB M0 cũ.
6. Rust tests cho `repo/menu` xanh; toàn bộ CI gate xanh.
