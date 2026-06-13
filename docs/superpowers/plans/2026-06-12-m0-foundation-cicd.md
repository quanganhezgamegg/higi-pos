# HiGi POS — M0: Nền tảng & CI/CD — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng bộ khung dự án HiGi POS (Tauri 2 + React/TS + Tailwind v4 + shadcn/ui, lõi Rust + SQLite) chạy được như một cửa sổ desktop, với một lát cắt dọc "settings" end-to-end, và hạ tầng chất lượng + CI/CD đầy đủ theo GitHub Flow.

**Architecture:** React (UI thuần) gọi Tauri commands qua IPC; Rust sở hữu SQLite (rusqlite + migrations), expose lệnh có kiểu. Lát cắt M0: `get_setting`/`set_setting` chứng minh trọn vòng UI → command → service → repo → SQLite → trở lại UI.

**Tech Stack:** Tauri 2, React 18 + TypeScript + Vite, Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui, React Router, rusqlite (bundled) + rusqlite_migration, Vitest + React Testing Library, ESLint flat + Prettier + lefthook + commitlint, GitHub Actions + tauri-action.

---

## Pre-flight — Môi trường Windows (đọc trước khi chạy lệnh)

Dự án đặt tại `C:\Users\anhhq\Documents\Claude\Projects\HiGI` — **nằm trong `Documents`, nhiều khả năng đồng bộ OneDrive**. Lưu ý đã xác minh:

- **OneDrive lock:** OneDrive khóa file giữa chừng khi sync → `npm install`/`shadcn` có thể lỗi `EPERM`/`ENOENT`. **Tạm dừng đồng bộ OneDrive** trong lúc cài đặt (hoặc cân nhắc chuyển repo ra `C:\dev\HiGI`).
- **PowerShell 5.1 không hỗ trợ `&&`:** chạy mỗi lệnh trên một dòng, hoặc dùng `;` / `if ($?) { ... }`. Khuyến nghị dùng **Git Bash** cho các lệnh có `&&`.
- **Execution policy:** nếu gặp "running scripts is disabled", chạy một lần: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (hoặc dùng Git Bash).
- **Yêu cầu cài sẵn (một lần):** Rust stable (`rustup`), **Microsoft C++ Build Tools** (MSVC), **WebView2 Runtime** (Windows 10/11 thường có sẵn), Node.js LTS (≥ 20).
- **Phiên bản đã xác minh (mid-2026):** tailwindcss 4.3.x, @tailwindcss/vite 4.3.x, shadcn CLI 4.11.x, vite 8.x, @vitejs/plugin-react 6.x. Lệnh dưới dùng `@latest`/không pin để npm tự lấy bản hợp lệ.

---

## File Structure (bản đồ trách nhiệm)

| File/Thư mục | Trách nhiệm |
|---|---|
| `.gitignore`, `.gitattributes`, `.editorconfig` | Vệ sinh repo, chuẩn hoá line-ending/encoding |
| `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html` | Cấu hình frontend build (Vite + alias `@/*`) |
| `src/index.css` | Điểm vào Tailwind v4 (`@import "tailwindcss";`) + token shadcn |
| `src/main.tsx`, `src/App.tsx` | Bootstrap React + Router |
| `src/routes/*` | Màn hình (M0: `Settings`, placeholder `Home`) |
| `src/components/ui/*` | Component shadcn (sở hữu trong repo) |
| `src/lib/format.ts` | Hàm thuần định dạng VND (đơn vị test thuần) |
| `src/lib/api/settings.ts` | Wrapper gọi Tauri command `invoke` |
| `src/test/setup.ts`, `vitest.config.ts` | Hạ tầng test frontend |
| `src-tauri/tauri.conf.json` | Cấu hình app Tauri (identifier, window, bundle) |
| `src-tauri/Cargo.toml` | Deps Rust |
| `src-tauri/src/main.rs`, `lib.rs` | Entry; đăng ký state + commands |
| `src-tauri/src/db/{mod.rs,migrations.rs}` | Kết nối SQLite + chạy migrations |
| `src-tauri/migrations/0001_init.sql` | Migration đầu: bảng `settings` |
| `src-tauri/src/repo/settings.rs` | Truy vấn `settings` (get/set) + unit test in-memory |
| `src-tauri/src/commands/settings.rs` | Tauri commands `get_setting`/`set_setting`/`app_version` |
| `.github/workflows/{ci.yml,release.yml}` | CI (lint/test/build) + CD (tauri-action release) |
| `.github/pull_request_template.md` | Mẫu PR |
| `lefthook.yml`, `eslint.config.js`, `.prettierrc.json`, `commitlint.config.js` | Chất lượng & hooks |
| `AGENTS.md`, `README.md`, `CONTRIBUTING.md` | Tài liệu & bộ nhớ Codex |

---

## Task 1: Repo hygiene files

**Files:**
- Create: `.gitignore`, `.gitattributes`, `.editorconfig`

- [ ] **Step 1: Tạo `.gitignore`**

```gitignore
# deps & build
node_modules/
dist/
dist-ssr/
*.local

# rust / tauri
src-tauri/target/
src-tauri/gen/

# database (không commit dữ liệu/CSDL local)
*.db
*.db-shm
*.db-wal

# editor / OS
.DS_Store
.idea/
.vscode/*
!.vscode/extensions.json
```

- [ ] **Step 2: Tạo `.gitattributes`** (chuẩn hoá line-ending — sửa cảnh báo LF→CRLF)

```gitattributes
* text=auto eol=lf
*.rs text eol=lf
*.{cmd,bat} text eol=crlf
*.png binary
*.ico binary
*.icns binary
```

- [ ] **Step 3: Tạo `.editorconfig`**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.rs]
indent_size = 4

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore .gitattributes .editorconfig
git commit -m "chore: add repo hygiene files (gitignore, gitattributes, editorconfig)"
```

---

## Task 2: Scaffold frontend Vite (React + TS)

**Files:** sinh tự động bởi scaffold (`package.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `tsconfig*.json`, `vite.config.ts`...)

> Tạm dừng OneDrive sync trước khi cài. Nếu shell là PowerShell 5.1, chạy từng dòng (không `&&`).

- [ ] **Step 1: Scaffold vào thư mục hiện tại** (giữ lại `docs/`, `.git/` đã có)

Run:
```bash
npm create vite@latest . -- --template react-ts
```
Khi hỏi "Current directory is not empty", chọn **"Ignore files and continue"**.

- [ ] **Step 2: Cài deps**

Run: `npm install`
Expected: thư mục `node_modules/` xuất hiện, không lỗi.

- [ ] **Step 3: Chạy thử dev server**

Run: `npm run dev`
Expected: Vite phục vụ tại `http://localhost:5173/`, mở trình duyệt thấy trang Vite+React mặc định. Dừng bằng `Ctrl+C`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite react-ts frontend"
```

---

## Task 3: Tailwind v4 + alias `@/*` + shadcn/ui

> Tailwind **v4** (CSS-first). TUYỆT ĐỐI KHÔNG tạo `tailwind.config.js`/`postcss.config.js`, không dùng `@tailwind base/...`.

**Files:**
- Install: `tailwindcss`, `@tailwindcss/vite`, `@types/node`
- Modify: `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `src/index.css`
- Create (qua CLI): `components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx`

- [ ] **Step 1: Cài Tailwind v4 + plugin + types**

Run:
```bash
npm install tailwindcss @tailwindcss/vite
npm install -D @types/node
```

- [ ] **Step 2: Ghi `vite.config.ts`** (plugin tailwind + alias `@`)

```ts
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

- [ ] **Step 3: Thêm `paths` vào `tsconfig.json`** (root chỉ có files/references — THÊM compilerOptions)

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 4: Thêm `baseUrl` + `paths` vào `tsconfig.app.json`** (merge vào `compilerOptions` sẵn có, giữ nguyên các option khác)

```jsonc
{
  "compilerOptions": {
    // ...giữ nguyên các option scaffold...
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 5: Thay toàn bộ `src/index.css` bằng đúng 1 dòng** (làm TRƯỚC khi chạy shadcn init)

```css
@import "tailwindcss";
```

- [ ] **Step 6: Khởi tạo shadcn** (đọc alias từ tsconfig, sinh `components.json` + `src/lib/utils.ts`, ghi token vào `index.css`)

Run: `npx shadcn@latest init`
- Chọn base color: **Neutral** (mặc định). Style: **new-york**.
Expected: tạo `components.json`, `src/lib/utils.ts`; `src/index.css` được nối thêm các khối `@theme`/biến CSS.

- [ ] **Step 7: Thêm component Button**

Run: `npx shadcn@latest add button`
Expected: tạo `src/components/ui/button.tsx`.

- [ ] **Step 8: Kiểm chứng Tailwind + Button render** — sửa `src/App.tsx`

```tsx
import { Button } from "@/components/ui/button"

function App() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <h1 className="text-3xl font-bold">HiGi POS</h1>
      <Button>Nút thử nghiệm</Button>
    </div>
  )
}

export default App
```

Run: `npm run dev`
Expected: trang nền theo theme, tiêu đề lớn, nút shadcn bo góc đúng style → Tailwind + shadcn hoạt động. Dừng `Ctrl+C`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: add tailwind v4, path alias, and shadcn/ui"
```

---

## Task 4: Bọc Tauri 2 (desktop shell)

**Files:**
- Install: `@tauri-apps/cli`, `@tauri-apps/api`
- Create (qua CLI): `src-tauri/` (Cargo.toml, src/main.rs, src/lib.rs, tauri.conf.json, icons...)
- Modify: `vite.config.ts` (override Tauri), `src-tauri/tauri.conf.json`

- [ ] **Step 1: Cài Tauri CLI + API**

Run: `npm install -D @tauri-apps/cli`
Run: `npm install @tauri-apps/api`

- [ ] **Step 2: Khởi tạo Tauri (không tương tác)**

Run (một dòng, dùng Git Bash nếu PowerShell 5.1):
```bash
npx tauri init --ci --app-name "HiGi POS" --window-title "HiGi POS" --frontend-dist "../dist" --dev-url "http://localhost:5173" --before-dev-command "npm run dev" --before-build-command "npm run build"
```
Expected: tạo thư mục `src-tauri/`.

- [ ] **Step 3: Cập nhật `vite.config.ts` sang biến thể Tauri** (giữ react + tailwind + alias, thêm override)

```ts
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: process.env.TAURI_ENV_PLATFORM == "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
})
```

- [ ] **Step 4: Chỉnh `src-tauri/tauri.conf.json`** (identifier, kích thước cửa sổ, bundle msi+nsis)

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "HiGi POS",
  "version": "0.1.0",
  "identifier": "com.higi.pos",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "HiGi POS",
        "width": 1280,
        "height": 800,
        "minWidth": 1024,
        "minHeight": 720
      }
    ],
    "security": { "csp": null }
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

- [ ] **Step 5: Chạy app desktop**

Run: `npx tauri dev`
Expected: lần đầu Rust biên dịch (vài phút), sau đó **mở cửa sổ desktop "HiGi POS"** hiển thị tiêu đề + nút. Dừng `Ctrl+C`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: wrap frontend in tauri 2 desktop shell"
```

---

## Task 5: Lớp DB Rust — kết nối SQLite + migrations

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/db/mod.rs`, `src-tauri/src/db/migrations.rs`, `src-tauri/migrations/0001_init.sql`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Thêm deps vào `src-tauri/Cargo.toml`** (mục `[dependencies]`)

```toml
[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.32", features = ["bundled"] }
rusqlite_migration = "1"
thiserror = "1"
```
> Ghi chú: `bundled` để SQLite biên dịch kèm (không phụ thuộc DLL hệ thống). Nếu `cargo` báo bản `rusqlite`/`rusqlite_migration` mới hơn, dùng bản mới nhất tương thích.

- [ ] **Step 2: Tạo migration `src-tauri/migrations/0001_init.sql`**

```sql
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

- [ ] **Step 3: Tạo `src-tauri/src/db/migrations.rs`**

```rust
use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};

/// Tập migrations của ứng dụng (thêm M::up mới ở CUỐI danh sách khi tiến hoá schema).
pub fn migrations() -> Migrations<'static> {
    Migrations::new(vec![M::up(include_str!(
        "../../migrations/0001_init.sql"
    ))])
}

/// Đưa CSDL về schema mới nhất.
pub fn run(conn: &mut Connection) -> Result<(), rusqlite_migration::Error> {
    migrations().to_latest(conn)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_valid() {
        // rusqlite_migration kiểm tra tính hợp lệ của tập migration.
        assert!(migrations().validate().is_ok());
    }
}
```

- [ ] **Step 4: Tạo `src-tauri/src/db/mod.rs`** (state giữ connection + mở DB)

```rust
pub mod migrations;

use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;

/// State được Tauri quản lý: bọc Connection trong Mutex (app 1 máy, 1 người dùng).
pub struct AppDb(pub Mutex<Connection>);

/// Mở (hoặc tạo) file DB tại `path` và chạy migrations.
pub fn open_and_migrate(path: &Path) -> Result<Connection, Box<dyn std::error::Error>> {
    let mut conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    migrations::run(&mut conn)?;
    Ok(conn)
}
```

- [ ] **Step 5: Khai báo module `db` trong `src-tauri/src/lib.rs`** (thêm dòng đầu file, cạnh các mod khác)

```rust
mod db;
```

- [ ] **Step 6: Build + chạy test migration**

Run: `cargo test --manifest-path src-tauri/Cargo.toml migrations_are_valid`
Expected: `test ... migrations::tests::migrations_are_valid ... ok`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(db): add sqlite connection state and migrations infra"
```

---

## Task 6: Repo `settings` (TDD — in-memory SQLite)

**Files:**
- Create: `src-tauri/src/repo/mod.rs`, `src-tauri/src/repo/settings.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Tạo `src-tauri/src/repo/mod.rs`**

```rust
pub mod settings;
```

- [ ] **Step 2: Khai báo `mod repo;` trong `src-tauri/src/lib.rs`**

```rust
mod repo;
```

- [ ] **Step 3: Viết test THẤT BẠI trước** — tạo `src-tauri/src/repo/settings.rs` chỉ với phần test (chưa có impl)

```rust
use rusqlite::Connection;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;

    fn test_conn() -> Connection {
        let mut c = Connection::open_in_memory().unwrap();
        migrations::run(&mut c).unwrap();
        c
    }

    #[test]
    fn set_then_get_returns_value() {
        let conn = test_conn();
        set_setting(&conn, "shop_name", "HiGi").unwrap();
        assert_eq!(
            get_setting(&conn, "shop_name").unwrap(),
            Some("HiGi".to_string())
        );
    }

    #[test]
    fn set_twice_overwrites() {
        let conn = test_conn();
        set_setting(&conn, "shop_name", "A").unwrap();
        set_setting(&conn, "shop_name", "B").unwrap();
        assert_eq!(get_setting(&conn, "shop_name").unwrap(), Some("B".to_string()));
    }

    #[test]
    fn get_missing_returns_none() {
        let conn = test_conn();
        assert_eq!(get_setting(&conn, "nope").unwrap(), None);
    }
}
```

- [ ] **Step 4: Chạy test để xác nhận FAIL (chưa biên dịch được vì thiếu hàm)**

Run: `cargo test --manifest-path src-tauri/Cargo.toml settings`
Expected: FAIL — lỗi biên dịch "cannot find function `set_setting`/`get_setting`".

- [ ] **Step 5: Viết impl tối thiểu** — thêm vào ĐẦU `src-tauri/src/repo/settings.rs` (trên khối test)

```rust
use rusqlite::{params, OptionalExtension};

/// Ghi/ghi đè một cấu hình key-value.
pub fn set_setting(conn: &Connection, key: &str, value: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO settings(key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

/// Đọc một cấu hình; trả None nếu không tồn tại.
pub fn get_setting(conn: &Connection, key: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get::<_, String>(0),
    )
    .optional()
}
```

- [ ] **Step 6: Chạy test để xác nhận PASS**

Run: `cargo test --manifest-path src-tauri/Cargo.toml settings`
Expected: `test result: ok. 3 passed`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(repo): add settings get/set with in-memory tests"
```

---

## Task 7: VND formatter (TDD — Vitest)

**Files:**
- Install: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/dom`, `jsdom`
- Create: `vitest.config.ts`, `src/test/setup.ts`, `src/lib/format.ts`, `src/lib/format.test.ts`
- Modify: `package.json` (script `test`)

- [ ] **Step 1: Cài deps test**

Run:
```bash
npm install -D vitest jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom
```

- [ ] **Step 2: Tạo `vitest.config.ts`** (tách khỏi vite.config để không nạp plugin tailwind khi test)

```ts
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
})
```

- [ ] **Step 3: Tạo `src/test/setup.ts`**

```ts
import "@testing-library/jest-dom"
```

- [ ] **Step 4: Thêm script test vào `package.json`** (mục `scripts`)

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 5: Viết test THẤT BẠI trước** — tạo `src/lib/format.test.ts`

```ts
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
```

- [ ] **Step 6: Chạy test để xác nhận FAIL**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL — "Failed to resolve import '@/lib/format'" hoặc "formatVnd is not a function".

- [ ] **Step 7: Viết impl** — tạo `src/lib/format.ts`

```ts
/** Định dạng số tiền VND: nghìn ngăn bằng dấu chấm, hậu tố " ₫", làm tròn về đồng nguyên. */
export function formatVnd(amount: number): string {
  const rounded = Math.round(amount)
  return `${new Intl.NumberFormat("vi-VN").format(rounded)} ₫`
}
```

- [ ] **Step 8: Chạy test để xác nhận PASS**

Run: `npx vitest run src/lib/format.test.ts`
Expected: `3 passed`.
> Nếu lỗi do khoảng trắng nhóm số: môi trường Node phải có ICU đầy đủ (Node LTS chính thức có). Nếu vẫn lệch, đổi assert sang dùng ` `/kiểm tra runtime — nhưng Node LTS chuẩn cho `35.000`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(lib): add VND currency formatter with tests"
```

---

## Task 8: Lát cắt dọc Settings (commands + API + màn hình)

**Files:**
- Install: `react-router-dom`
- Create: `src-tauri/src/commands/mod.rs`, `src-tauri/src/commands/settings.rs`, `src/lib/api/settings.ts`, `src/routes/Home.tsx`, `src/routes/Settings.tsx`
- Modify: `src-tauri/src/lib.rs` (state + invoke_handler), `src/main.tsx`, `src/App.tsx`

- [ ] **Step 1: Tạo `src-tauri/src/commands/settings.rs`**

```rust
use tauri::State;

use crate::db::AppDb;
use crate::repo::settings;

#[tauri::command]
pub fn get_setting(db: State<AppDb>, key: String) -> Result<Option<String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    settings::get_setting(&conn, &key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_setting(db: State<AppDb>, key: String, value: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    settings::set_setting(&conn, &key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
```

- [ ] **Step 2: Tạo `src-tauri/src/commands/mod.rs`**

```rust
pub mod settings;
```

- [ ] **Step 3: Nối state DB + commands trong `src-tauri/src/lib.rs`**

`npx tauri init` đã sinh sẵn `lib.rs` với hàm `run()` mẫu (kèm lệnh `greet` và plugin `opener`). **Thay thế toàn bộ nội dung `lib.rs`** bằng phiên bản dưới (xoá lệnh `greet` mẫu; closure `.setup` của Tauri 2 trả về `Result<(), Box<dyn std::error::Error>>` nên dùng thẳng `?`):

```rust
mod commands;
mod db;
mod repo;

use std::sync::Mutex;
use tauri::Manager;

use crate::db::AppDb;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let db_path = dir.join("higipos.db");
            let conn = db::open_and_migrate(&db_path)?;
            app.manage(AppDb(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::app_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```
> Lưu ý: nếu muốn giữ plugin `opener` mà template sinh ra, thêm lại dòng `.plugin(tauri_plugin_opener::init())` (và giữ dep `tauri-plugin-opener` trong `Cargo.toml`); M0 không cần nên có thể bỏ. `main.rs` giữ nguyên (gọi `app_lib::run()` / `<crate>_lib::run()`).

- [ ] **Step 4: Build Rust để xác nhận biên dịch**

Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: biên dịch thành công (cảnh báo về hàm chưa dùng là chấp nhận được).

- [ ] **Step 5: Tạo wrapper API `src/lib/api/settings.ts`**

```ts
import { invoke } from "@tauri-apps/api/core"

export function getSetting(key: string): Promise<string | null> {
  return invoke<string | null>("get_setting", { key })
}

export function setSetting(key: string, value: string): Promise<void> {
  return invoke<void>("set_setting", { key, value })
}

export function appVersion(): Promise<string> {
  return invoke<string>("app_version")
}
```

- [ ] **Step 6: Cài React Router**

Run: `npm install react-router-dom`

- [ ] **Step 7: Tạo màn hình `src/routes/Home.tsx`**

```tsx
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold">HiGi POS</h1>
      <Button asChild>
        <Link to="/settings">Mở Cài đặt</Link>
      </Button>
    </div>
  )
}
```

- [ ] **Step 8: Tạo màn hình `src/routes/Settings.tsx`** (lát cắt dọc: đọc/ghi tên quán)

```tsx
import { useEffect, useState } from "react"
import { getSetting, setSetting } from "@/lib/api/settings"
import { Button } from "@/components/ui/button"

const KEY = "shop_name"

export default function Settings() {
  const [name, setName] = useState("")
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    getSetting(KEY).then((v) => {
      setSaved(v)
      if (v) setName(v)
    })
  }, [])

  async function onSave() {
    await setSetting(KEY, name)
    const v = await getSetting(KEY)
    setSaved(v)
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-8">
      <h1 className="text-2xl font-bold">Cài đặt quán</h1>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">Tên quán</span>
        <input
          className="rounded-md border px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <Button onClick={onSave}>Lưu</Button>
      <p className="text-sm text-muted-foreground">
        Đã lưu: <strong>{saved ?? "(chưa có)"}</strong>
      </p>
    </div>
  )
}
```

- [ ] **Step 9: Cấu hình router** — ghi `src/App.tsx`

```tsx
import { createBrowserRouter, RouterProvider } from "react-router-dom"
import Home from "@/routes/Home"
import Settings from "@/routes/Settings"

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/settings", element: <Settings /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
```

- [ ] **Step 10: Đảm bảo `src/main.tsx` import CSS + render App**

```tsx
import React from "react"
import ReactDOM from "react-dom/client"
import App from "@/App"
import "@/index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 11: Kiểm chứng end-to-end**

Run: `npx tauri dev`
Expected: cửa sổ mở → bấm "Mở Cài đặt" → nhập tên quán → "Lưu" → dòng "Đã lưu" cập nhật. **Đóng app, mở lại** (`npx tauri dev`): tên quán vẫn còn (đã ghi vào SQLite ở AppData). Dừng `Ctrl+C`.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: settings vertical slice (rust commands + api + screens + router)"
```

---

## Task 9: Chất lượng & hooks (ESLint, Prettier, lefthook, commitlint)

**Files:**
- Install: `eslint @eslint/js typescript-eslint eslint-plugin-react-hooks globals prettier lefthook @commitlint/cli @commitlint/config-conventional`
- Create: `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `lefthook.yml`, `commitlint.config.js`
- Modify: `package.json` (scripts lint/format)

- [ ] **Step 1: Cài deps**

Run:
```bash
npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks globals prettier lefthook @commitlint/cli @commitlint/config-conventional
```

- [ ] **Step 2: Tạo `eslint.config.js`** (flat config)

```js
import js from "@eslint/js"
import tseslint from "typescript-eslint"
import reactHooks from "eslint-plugin-react-hooks"
import globals from "globals"

export default tseslint.config(
  { ignores: ["dist", "src-tauri/target", "src-tauri/gen", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
)
```

- [ ] **Step 3: Tạo `.prettierrc.json`**

```json
{
  "semi": false,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 4: Tạo `.prettierignore`**

```
dist
node_modules
src-tauri/target
src-tauri/gen
package-lock.json
```

- [ ] **Step 5: Tạo `commitlint.config.js`**

```js
export default { extends: ["@commitlint/config-conventional"] }
```

- [ ] **Step 6: Tạo `lefthook.yml`**

```yaml
pre-commit:
  parallel: true
  commands:
    eslint:
      glob: "*.{js,ts,tsx}"
      run: npx eslint --fix {staged_files}
      stage_fixed: true
    prettier:
      glob: "*.{js,ts,tsx,json,css,md,yml,yaml}"
      run: npx prettier --write {staged_files}
      stage_fixed: true
    rustfmt:
      glob: "*.rs"
      run: cargo fmt --manifest-path src-tauri/Cargo.toml
commit-msg:
  commands:
    commitlint:
      run: npx commitlint --edit {1}
```

- [ ] **Step 7: Thêm scripts vào `package.json`**

```json
{
  "scripts": {
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

- [ ] **Step 8: Cài git hooks**

Run: `npx lefthook install`
Expected: "lefthook installed" — tạo các hook trong `.git/hooks`.

- [ ] **Step 9: Kiểm chứng lint + format chạy**

Run: `npm run lint`
Expected: không lỗi (sửa nếu có cảnh báo phát sinh từ code đã viết).
Run: `npm run format`
Expected: Prettier ghi lại file, exit 0.

- [ ] **Step 10: Kiểm chứng hook chặn commit sai chuẩn**

Run:
```bash
git add -A
git commit -m "bad message"
```
Expected: commit-msg hook **fail** (không đúng Conventional Commits). Sau đó commit đúng chuẩn:
```bash
git commit -m "chore: add eslint, prettier, lefthook, commitlint"
```
Expected: pre-commit chạy lint/format/rustfmt rồi commit thành công.

---

## Task 10: CI workflow (GitHub Actions)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Tạo `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  frontend:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run lint
      - run: npm run format:check
      - run: npm run test
      - run: npm run build

  rust:
    runs-on: windows-latest
    defaults:
      run:
        working-directory: src-tauri
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy
      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: "src-tauri -> target"
      - run: cargo fmt --check
      - run: cargo clippy -- -D warnings
      - run: cargo test
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add frontend + rust CI workflow"
```

> Kiểm chứng thực sự xảy ra sau khi đẩy lên GitHub (Task 12) — CI chạy trên PR/push. Local: đảm bảo từng lệnh trong workflow chạy được (`npx tsc --noEmit`, `npm run lint`, `npm run format:check`, `npm run test`, `npm run build`, và trong `src-tauri`: `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`).

---

## Task 11: CD release workflow + PR template

**Files:**
- Create: `.github/workflows/release.yml`, `.github/pull_request_template.md`

- [ ] **Step 1: Tạo `.github/workflows/release.yml`**

```yaml
name: Release

on:
  push:
    tags:
      - "v*"

permissions:
  contents: write

jobs:
  release:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: "src-tauri -> target"
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: "HiGi POS ${{ github.ref_name }}"
          releaseBody: "Tự sinh từ tag. Tải installer Windows ở mục Assets."
          releaseDraft: true
          prerelease: false
```

- [ ] **Step 2: Tạo `.github/pull_request_template.md`**

```markdown
## Mục tiêu
<!-- PR này làm gì? Liên kết milestone/issue nếu có. -->

## Thay đổi chính
-

## Ảnh chụp UI (nếu có)

## Checklist
- [ ] CI xanh (lint, format, test, build)
- [ ] Đã tự test luồng liên quan
- [ ] Commit theo Conventional Commits
- [ ] Cập nhật `AGENTS.md`/docs nếu có quyết định/quy ước mới
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml .github/pull_request_template.md
git commit -m "ci: add tauri-action release workflow and PR template"
```

---

## Task 12: Tài liệu (AGENTS.md, README, CONTRIBUTING) + đẩy lên GitHub

**Files:**
- Create: `AGENTS.md`, `README.md`, `CONTRIBUTING.md`

- [ ] **Step 1: Tạo `AGENTS.md`** (bộ nhớ cho Codex)

```markdown
# AGENTS.md — HiGi POS

App POS bán hàng tại quầy cho một quán cà phê. Windows desktop, **offline**, 1 máy, dữ liệu SQLite local.

## Tech stack
- Tauri 2 (Rust core) + React 18 + TypeScript + Vite
- Tailwind CSS v4 (`@tailwindcss/vite`, CSS-first — KHÔNG có tailwind.config.js) + shadcn/ui
- SQLite qua rusqlite (bundled) + rusqlite_migration
- React Router; (Zustand + TanStack Query sẽ thêm khi cần ở milestone sau)
- Test: Vitest + React Testing Library (FE), `cargo test` + in-memory SQLite (Rust)

## Kiến trúc (BẮT BUỘC tuân thủ)
- React chỉ làm UI. KHÔNG truy cập SQL trực tiếp.
- Mọi đọc/ghi qua Tauri command có kiểu (`src-tauri/src/commands/*`).
- Logic nghiệp vụ + tiền bạc nằm ở Rust (`services`/`repo`), chạy trong transaction.
- Snapshot tên + giá vào dòng đơn để bill/báo cáo cũ không sai khi menu đổi.

## Lệnh thường dùng
- `npm run dev` — chạy frontend (Vite :5173)
- `npx tauri dev` — chạy app desktop (dev)
- `npx tauri build` — đóng gói installer .msi/.exe
- `npm run test` — test frontend (Vitest)
- `npm run lint` / `npm run format` — ESLint / Prettier
- `cargo test --manifest-path src-tauri/Cargo.toml` — test Rust
- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`

## Ràng buộc sản phẩm
- Tiếng Việt; tiền VND không thập phân (`35.000 ₫`), dùng `formatVnd` trong `src/lib/format.ts`.
- Tối ưu cảm ứng (nút to). Không đăng nhập/không phân quyền ở v1. Không VAT ở v1.
- Thanh toán: tiền mặt + QR/chuyển khoản (xác nhận thủ công). Chưa có máy in → bill PDF/màn hình.

## Quy trình
- GitHub Flow: nhánh `feat/…|fix/…|chore/…` → PR → CI xanh → merge (squash).
- Conventional Commits (bắt buộc qua commitlint). Pre-commit: lefthook chạy eslint/prettier/rustfmt.
- Release: tag `vX.Y.Z` → CD build installer (tauri-action).

## Tài liệu
- Spec thiết kế: `docs/superpowers/specs/2026-06-12-higi-pos-design.md`
- Kế hoạch theo milestone: `docs/superpowers/plans/`

## Cập nhật file này mỗi khi có quyết định/quy ước/cấu trúc mới.
```

- [ ] **Step 2: Tạo `README.md`**

```markdown
# HiGi POS

Phần mềm bán hàng (POS) cho quán cà phê — Windows desktop, offline, dữ liệu SQLite local.

## Yêu cầu
- Node.js LTS (≥ 20), Rust stable (`rustup`), Microsoft C++ Build Tools, WebView2 Runtime.

## Phát triển
```bash
npm install
npx tauri dev      # mở app desktop (dev)
```

## Build installer
```bash
npx tauri build    # tạo .msi/.exe trong src-tauri/target/release/bundle
```

## Test
```bash
npm run test                                   # frontend (Vitest)
cargo test --manifest-path src-tauri/Cargo.toml  # rust
```

Xem `AGENTS.md` để biết kiến trúc & quy ước, `docs/superpowers/` để biết spec & kế hoạch.
```

- [ ] **Step 3: Tạo `CONTRIBUTING.md`**

```markdown
# Đóng góp

- Mô hình nhánh: **GitHub Flow**. Mỗi việc một nhánh `feat/…`, `fix/…`, `chore/…` → PR vào `main`.
- Commit theo **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`).
- Trước khi mở PR: `npm run lint`, `npm run format:check`, `npm run test`, và `cargo test`/`cargo clippy` phải xanh.
- PR chỉ merge khi **CI xanh**. Ưu tiên squash merge.
```

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md README.md CONTRIBUTING.md
git commit -m "docs: add AGENTS.md, README, and CONTRIBUTING"
```

- [ ] **Step 5: Tạo repo GitHub private + đẩy lên** (cần `gh` đã đăng nhập — nếu chưa: gợi ý user chạy `! gh auth login`)

```bash
gh repo create higi-pos --private --source=. --remote=origin --push
```
Expected: repo private được tạo, push `main` thành công.

- [ ] **Step 6: Bật branch protection cho `main`** (qua GitHub UI hoặc `gh api`): yêu cầu PR + status checks `frontend`, `rust` xanh trước khi merge; cấm push thẳng.

- [ ] **Step 7: Kiểm chứng CD (tùy chọn)** — gắn tag thử để xác nhận release build:

```bash
git tag v0.1.0
git push origin v0.1.0
```
Expected: workflow **Release** chạy, tạo Release nháp kèm installer `.msi`/`.exe` trong Assets.

---

## Definition of Done (M0)

- [ ] `npx tauri dev` mở cửa sổ "HiGi POS"; lưu/đọc "tên quán" bền vững qua lần mở lại (SQLite).
- [ ] `npm run test` và `cargo test` đều xanh; `npm run lint`, `npm run format:check`, `cargo clippy -- -D warnings` đều xanh.
- [ ] Pre-commit hooks + commitlint hoạt động (chặn commit/format sai).
- [ ] Repo trên GitHub, CI xanh trên PR/push `main`, branch protection bật.
- [ ] Tag `v*` build ra installer Windows qua CD (đã thử ≥ 1 lần hoặc xác nhận workflow hợp lệ).
- [ ] `AGENTS.md`, `README.md`, `CONTRIBUTING.md` có mặt và chính xác.
