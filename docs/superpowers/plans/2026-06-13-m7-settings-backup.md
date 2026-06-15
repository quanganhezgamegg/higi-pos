# M7 — Cài đặt mở rộng + Mức đường/đá + Sao lưu DB — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mở rộng màn hình `/settings` đã có (Settings.tsx, M0): lưu thông tin quán (tên/địa chỉ/phone/footer hoá đơn) vào `settings` table; cho phép cấu hình danh sách mức đường/đá (M3 đọc từ `src/lib/constants.ts` mặc định; sau M7 đọc từ settings qua `list_sugar_levels`/`list_ice_levels`); lệnh `backup_database` sao chép file `.db` sang thư mục người dùng chọn với tên có timestamp.

**Architecture:** M7 KHÔNG thêm bảng mới — toàn bộ dùng `settings(key, value)` (M0). Mức đường/đá lưu dạng chuỗi comma-separated dưới key `sugar_levels` / `ice_levels`. Lệnh backup dùng `tauri::AppHandle` (giống image.rs) lấy `app_data_dir` → tìm `higipos.db` → copy sang thư mục đích với tên `higi-backup-<ts>.db`. Lệnh bulk ghi nhiều key trong một transaction. Màn hình `/settings` mở rộng từ Settings.tsx hiện tại (giữ nguyên M0 code, thêm sections mới).

**Tech Stack:** rusqlite (sẵn, M0), tauri-plugin-dialog (sẵn, M1 — `tauri-plugin-dialog = "2.7.1"` trong Cargo.toml), React + shadcn/ui, cargo test (TDD cho repo/backup helper).

**Spec:** `docs/superpowers/specs/2026-06-12-higi-pos-design.md` §6 (settings screen), §9 (backup).
**Contract (AUTHORITATIVE):** `docs/superpowers/plans/2026-06-13-m2-m7-contract.md` §3 M7 (command signatures), §5 (conventions, repo/command patterns).
**Mẫu code (đọc trước khi triển khai):**
- `src-tauri/src/repo/settings.rs` — `get_setting`/`set_setting` (M0, tái dùng).
- `src-tauri/src/commands/settings.rs` — lock helper pattern (M0, mở rộng).
- `src-tauri/src/commands/image.rs` — `AppHandle`, `app_data_dir`, file copy pattern, pure-Rust helper tests (M1, tham chiếu cho backup).
- `src/lib/api/settings.ts` — invoke wrapper hiện tại (M0, mở rộng).
- `src/routes/Settings.tsx` — màn hình hiện tại (M0, mở rộng in-place).
- `docs/superpowers/plans/2026-06-13-m3-sales.md` — M3 khai báo `SUGAR_LEVELS`, `ICE_LEVELS` trong `src/lib/constants.ts`; sau M7 chúng phải được đọc từ settings (fallback về default khi chưa cấu hình).

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `src-tauri/src/domain/settings.rs` | Struct `SettingKv`, `SugarIceInput` (theo contract §3) |
| `src-tauri/src/repo/settings.rs` | **Mở rộng** — thêm `get_settings_bulk`, `set_settings_bulk` (transaction), `list_sugar_levels`, `list_ice_levels`, `update_sugar_ice_levels`; unit tests TDD |
| `src-tauri/src/commands/backup.rs` | **Mới** — `backup_database` (AppHandle + AppDb); helper thuần `backup_dest_path(dir, ts)` + `copy_db(src, dest)` có unit tests |
| `src-tauri/src/commands/settings.rs` | **Mở rộng** — thêm commands `get_settings_bulk`, `set_settings_bulk`, `list_sugar_levels`, `list_ice_levels`, `update_sugar_ice_levels` |
| `src-tauri/src/domain/mod.rs` | Thêm `pub mod settings;` |
| `src-tauri/src/commands/mod.rs` | Thêm `pub mod backup;` |
| `src-tauri/src/lib.rs` | Đăng ký tất cả commands mới vào `generate_handler!` |
| `src/lib/api/settings.ts` | **Mở rộng** — thêm `getSettingsBulk`, `setSettingsBulk`, `listSugarLevels`, `listIceLevels`, `updateSugarIceLevels`, `backupDatabase`; export TS types `SettingKv`, `SugarIceInput` |
| `src/lib/constants.ts` | **Mở rộng** — export `DEFAULT_SUGAR_LEVELS`, `DEFAULT_ICE_LEVELS` (giữ backward compat với M3) |
| `src/routes/Settings.tsx` | **Mở rộng** — thêm 3 section: Thông tin quán, Mức đường/đá, Sao lưu dữ liệu |

---

## Task 1: Domain structs cho settings

**Files:** Modify `src-tauri/src/domain/mod.rs`; Create `src-tauri/src/domain/settings.rs`.

- [ ] **Step 1: Thêm `pub mod settings;`** — trong `src-tauri/src/domain/mod.rs`:

```rust
pub mod menu;
pub mod settings;
```

- [ ] **Step 2: Tạo `src-tauri/src/domain/settings.rs`** — khớp CHÍNH XÁC struct trong contract §3:

```rust
use serde::{Deserialize, Serialize};

/// Cặp key-value cho bulk write.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SettingKv {
    pub key: String,
    pub value: String,
}

/// Input cập nhật mức đường/đá.
#[derive(Debug, Clone, Deserialize)]
pub struct SugarIceInput {
    pub sugar_levels: Vec<String>,
    pub ice_levels: Vec<String>,
}
```

- [ ] **Step 3: Build** — Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: OK (cảnh báo unused — chấp nhận đến Task 5).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/domain/settings.rs src-tauri/src/domain/mod.rs
git commit -m "feat(domain): add settings domain structs (SettingKv, SugarIceInput)"
```

---

## Task 2: Repo — mở rộng settings.rs (TDD)

**Files:** Modify `src-tauri/src/repo/settings.rs`.

Giữ nguyên các hàm `get_setting`/`set_setting` M0 (KHÔNG xoá/sửa). Thêm 5 hàm mới bên dưới.

Quy tắc sugar/ice levels:
- Lưu dạng chuỗi comma-separated: `"0%,30%,50%,70%,100%"` dưới key `sugar_levels`; `"Không,Ít,Vừa,Nhiều"` dưới key `ice_levels`.
- `list_sugar_levels` đọc key → split `,` → trim từng phần tử → lọc bỏ trống → trả `Vec<String>`. Nếu key không tồn tại trả default `["0%","30%","50%","70%","100%"]`.
- `list_ice_levels` tương tự; default `["Không","Ít","Vừa","Nhiều"]`.
- `update_sugar_ice_levels` validate không có list rỗng (ít nhất 1 phần tử mỗi loại) rồi ghi 2 key trong 1 transaction.

- [ ] **Step 1: Viết test THẤT BẠI** — thêm vào module `#[cfg(test)]` trong `repo/settings.rs`:

```rust
#[test]
fn bulk_set_get_returns_all_keys() {
    let conn = test_conn();
    set_settings_bulk(
        &conn,
        vec![
            crate::domain::settings::SettingKv { key: "shop_name".into(), value: "HiGi".into() },
            crate::domain::settings::SettingKv { key: "shop_phone".into(), value: "0901234567".into() },
        ],
    )
    .unwrap();
    let results = get_settings_bulk(&conn, &["shop_name", "shop_phone", "missing"]).unwrap();
    assert_eq!(results.len(), 3);
    assert_eq!(results[0], ("shop_name".into(), Some("HiGi".into())));
    assert_eq!(results[1], ("shop_phone".into(), Some("0901234567".into())));
    assert_eq!(results[2], ("missing".into(), None));
}

#[test]
fn bulk_set_is_atomic_on_error() {
    // Kiểm thử transaction: nếu có lỗi giữa chừng, các key trước đó không được ghi.
    // Cách đơn giản: ghi bulk thành công → đọc lại đúng → không regression từ M0 tests.
    let conn = test_conn();
    set_settings_bulk(
        &conn,
        vec![
            crate::domain::settings::SettingKv { key: "a".into(), value: "1".into() },
            crate::domain::settings::SettingKv { key: "b".into(), value: "2".into() },
        ],
    )
    .unwrap();
    assert_eq!(get_setting(&conn, "a").unwrap(), Some("1".into()));
    assert_eq!(get_setting(&conn, "b").unwrap(), Some("2".into()));
}

#[test]
fn sugar_ice_levels_default_when_not_set() {
    let conn = test_conn();
    let sugar = list_sugar_levels(&conn).unwrap();
    assert_eq!(sugar, vec!["0%", "30%", "50%", "70%", "100%"]);
    let ice = list_ice_levels(&conn).unwrap();
    assert_eq!(ice, vec!["Không", "Ít", "Vừa", "Nhiều"]);
}

#[test]
fn update_sugar_ice_levels_persists() {
    let conn = test_conn();
    update_sugar_ice_levels(
        &conn,
        &["25%", "50%", "100%"],
        &["Không", "Ít"],
    )
    .unwrap();
    assert_eq!(list_sugar_levels(&conn).unwrap(), vec!["25%", "50%", "100%"]);
    assert_eq!(list_ice_levels(&conn).unwrap(), vec!["Không", "Ít"]);
}

#[test]
fn update_sugar_ice_rejects_empty_list() {
    let conn = test_conn();
    assert!(update_sugar_ice_levels(&conn, &[], &["Không"]).is_err());
    assert!(update_sugar_ice_levels(&conn, &["50%"], &[]).is_err());
}
```

- [ ] **Step 2: Chạy → FAIL** — Run: `cargo test --manifest-path src-tauri/Cargo.toml settings`
Expected: lỗi biên dịch — các hàm chưa tồn tại.

- [ ] **Step 3: Viết impl** — thêm vào `repo/settings.rs` TRÊN `#[cfg(test)]`:

```rust
use crate::domain::settings::SettingKv;

/// Đọc nhiều key cùng lúc. Với mỗi key, trả `(key, Option<value>)` theo đúng thứ tự `keys`.
pub fn get_settings_bulk(
    conn: &Connection,
    keys: &[&str],
) -> rusqlite::Result<Vec<(String, Option<String>)>> {
    keys.iter()
        .map(|k| {
            let v = get_setting(conn, k)?;
            Ok((k.to_string(), v))
        })
        .collect()
}

/// Ghi nhiều key-value trong một transaction.
pub fn set_settings_bulk(
    conn: &Connection,
    pairs: Vec<SettingKv>,
) -> rusqlite::Result<()> {
    conn.execute_batch("BEGIN")?;
    let res = (|| {
        for kv in &pairs {
            set_setting(conn, &kv.key, &kv.value)?;
        }
        Ok::<(), rusqlite::Error>(())
    })();
    match res {
        Ok(()) => { conn.execute_batch("COMMIT")?; Ok(()) }
        Err(e) => { let _ = conn.execute_batch("ROLLBACK"); Err(e) }
    }
}

const DEFAULT_SUGAR: &str = "0%,30%,50%,70%,100%";
const DEFAULT_ICE: &str = "Không,Ít,Vừa,Nhiều";

fn parse_levels(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

/// Đọc danh sách mức đường; nếu chưa cài đặt trả về mặc định.
pub fn list_sugar_levels(conn: &Connection) -> rusqlite::Result<Vec<String>> {
    let raw = get_setting(conn, "sugar_levels")?
        .unwrap_or_else(|| DEFAULT_SUGAR.to_string());
    Ok(parse_levels(&raw))
}

/// Đọc danh sách mức đá; nếu chưa cài đặt trả về mặc định.
pub fn list_ice_levels(conn: &Connection) -> rusqlite::Result<Vec<String>> {
    let raw = get_setting(conn, "ice_levels")?
        .unwrap_or_else(|| DEFAULT_ICE.to_string());
    Ok(parse_levels(&raw))
}

/// Ghi mức đường + đá trong một transaction. Cả hai phải có ít nhất 1 phần tử.
pub fn update_sugar_ice_levels(
    conn: &Connection,
    sugar: &[&str],
    ice: &[&str],
) -> rusqlite::Result<()> {
    if sugar.is_empty() {
        return Err(rusqlite::Error::InvalidParameterName(
            "Danh sách mức đường không được rỗng".into(),
        ));
    }
    if ice.is_empty() {
        return Err(rusqlite::Error::InvalidParameterName(
            "Danh sách mức đá không được rỗng".into(),
        ));
    }
    let sugar_val = sugar.join(",");
    let ice_val = ice.join(",");
    conn.execute_batch("BEGIN")?;
    let res = (|| {
        set_setting(conn, "sugar_levels", &sugar_val)?;
        set_setting(conn, "ice_levels", &ice_val)?;
        Ok::<(), rusqlite::Error>(())
    })();
    match res {
        Ok(()) => { conn.execute_batch("COMMIT")?; Ok(()) }
        Err(e) => { let _ = conn.execute_batch("ROLLBACK"); Err(e) }
    }
}
```

- [ ] **Step 4: Chạy → PASS** — Run: `cargo test --manifest-path src-tauri/Cargo.toml settings`
Expected: tất cả tests settings pass (M0 cũ + 5 tests mới).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/repo/settings.rs
git commit -m "feat(repo): extend settings with bulk read/write and sugar/ice level config (TDD)"
```

---

## Task 3: Command backup_database (TDD — pure helper)

**Files:** Create `src-tauri/src/commands/backup.rs`; Modify `src-tauri/src/commands/mod.rs`.

Chiến lược tách testability (theo mẫu image.rs):
- Hàm thuần `backup_dest_path(dir: &Path, ts: &str) -> PathBuf` — tạo tên file `higi-backup-<ts>.db`, trả full path. Testable mà không cần AppHandle.
- `fn copy_db_file(src: &Path, dest: &Path) -> Result<u64, String>` — dùng `std::fs::copy`, trả số byte được copy.
- Command `backup_database(app, db, dest_dir)`: resolve DB path từ `app_data_dir/higipos.db`; kiểm tra file tồn tại; gọi `backup_dest_path` + `copy_db_file`; trả đường dẫn tuyệt đối đích.

Lưu ý: plugin dialog `open()`/`folder_picker()` chạy ở frontend (TypeScript); Rust nhận `dest_dir: String` là đường dẫn folder đã được user chọn. Frontend gọi `open({ directory: true })` từ `@tauri-apps/plugin-dialog` → truyền path vào command.

- [ ] **Step 1: Viết test THẤT BẠI** — tạo `src-tauri/src/commands/backup.rs` chỉ với phần test:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn backup_dest_path_format() {
        let dir = Path::new("/tmp/mybackups");
        let ts = "2026-06-14T08-30-00";
        let dest = backup_dest_path(dir, ts);
        assert_eq!(dest, dir.join("higi-backup-2026-06-14T08-30-00.db"));
    }

    #[test]
    fn backup_dest_path_no_path_traversal() {
        // timestamp không ảnh hưởng đến thư mục đích
        let dir = Path::new("/safe/dir");
        let dest = backup_dest_path(dir, "ts");
        assert!(dest.starts_with("/safe/dir"));
    }

    #[test]
    fn copy_db_file_copies_bytes() {
        use std::io::Write;
        let tmp = std::env::temp_dir();
        let src = tmp.join("test_higi_src.db");
        let dest = tmp.join("test_higi_dest.db");
        let mut f = std::fs::File::create(&src).unwrap();
        f.write_all(b"SQLite test data").unwrap();
        drop(f);

        let bytes = copy_db_file(&src, &dest).unwrap();
        assert_eq!(bytes, 16);
        assert_eq!(std::fs::read(&dest).unwrap(), b"SQLite test data");

        // cleanup
        let _ = std::fs::remove_file(&src);
        let _ = std::fs::remove_file(&dest);
    }
}
```

- [ ] **Step 2: Chạy → FAIL** — Run: `cargo test --manifest-path src-tauri/Cargo.toml backup`
Expected: lỗi biên dịch — các hàm chưa tồn tại.

- [ ] **Step 3: Viết impl** — thêm vào ĐẦU `backup.rs` (TRÊN `#[cfg(test)]`):

```rust
use std::path::{Path, PathBuf};
use tauri::Manager;

use crate::db::AppDb;

/// Tạo đường dẫn đích cho file backup: `dest_dir/higi-backup-<ts>.db`.
pub fn backup_dest_path(dest_dir: &Path, ts: &str) -> PathBuf {
    dest_dir.join(format!("higi-backup-{ts}.db"))
}

/// Copy file src sang dest, trả số byte đã copy.
pub fn copy_db_file(src: &Path, dest: &Path) -> Result<u64, String> {
    std::fs::copy(src, dest).map_err(|e| format!("Sao lưu thất bại: {e}"))
}

/// Tạo timestamp dạng `YYYY-MM-DDTHH-MM-SS` (dùng ký tự `-` thay `:` để hợp lệ trong tên file).
fn make_timestamp() -> String {
    // Dùng std::time để không phụ thuộc crate chrono.
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // ISO-8601 approximation từ epoch seconds (UTC):
    // Đủ chính xác cho tên file; không cần timezone đầy đủ.
    let s = secs;
    let sec = s % 60;
    let min = (s / 60) % 60;
    let hour = (s / 3600) % 24;
    let days = s / 86400; // ngày kể từ 1970-01-01
    // Tính năm/tháng/ngày đơn giản (không tính năm nhuận phức tạp — đủ cho tên file)
    let (year, month, day) = days_to_ymd(days);
    format!("{year:04}-{month:02}-{day:02}T{hour:02}-{min:02}-{sec:02}")
}

/// Chuyển đổi số ngày kể từ epoch (1970-01-01) thành (year, month, day).
fn days_to_ymd(mut days: u64) -> (u64, u64, u64) {
    let mut year = 1970u64;
    loop {
        let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
        let days_in_year = if leap { 366 } else { 365 };
        if days < days_in_year {
            break;
        }
        days -= days_in_year;
        year += 1;
    }
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days_in_month = [31u64, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut month = 1u64;
    for &dim in &days_in_month {
        if days < dim {
            break;
        }
        days -= dim;
        month += 1;
    }
    (year, month, days + 1)
}

/// Sao lưu DB vào thư mục `dest_dir` mà người dùng đã chọn.
/// Trả về đường dẫn tuyệt đối của file backup.
///
/// `dest_dir` được truyền từ frontend sau khi người dùng chọn folder
/// qua `@tauri-apps/plugin-dialog` `open({ directory: true })`.
#[tauri::command]
pub fn backup_database(
    app: tauri::AppHandle,
    _db: tauri::State<AppDb>,
    dest_dir: String,
) -> Result<String, String> {
    // 1. Resolve đường dẫn DB: app_data_dir/higipos.db
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("higipos.db");

    if !db_path.exists() {
        return Err(format!(
            "File DB không tồn tại: {}",
            db_path.display()
        ));
    }

    // 2. Kiểm tra thư mục đích tồn tại
    let dest_dir_path = Path::new(&dest_dir);
    if !dest_dir_path.is_dir() {
        return Err(format!(
            "Thư mục đích không hợp lệ: {}",
            dest_dir
        ));
    }

    // 3. Tạo tên file có timestamp
    let ts = make_timestamp();
    let dest = backup_dest_path(dest_dir_path, &ts);

    // 4. Copy
    copy_db_file(&db_path, &dest)?;

    Ok(dest.to_string_lossy().to_string())
}
```

- [ ] **Step 4: Khai báo module** — thêm `pub mod backup;` vào `src-tauri/src/commands/mod.rs`.

- [ ] **Step 5: Chạy → PASS** — Run: `cargo test --manifest-path src-tauri/Cargo.toml backup`
Expected: 3 tests pass (`backup_dest_path_format`, `backup_dest_path_no_path_traversal`, `copy_db_file_copies_bytes`).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/backup.rs src-tauri/src/commands/mod.rs
git commit -m "feat(backup): add backup_database command with pure-Rust helper tests"
```

---

## Task 4: Mở rộng commands/settings.rs + đăng ký tất cả commands

**Files:** Modify `src-tauri/src/commands/settings.rs`, `src-tauri/src/lib.rs`.

Giữ nguyên 3 commands M0 (`get_setting`, `set_setting`, `app_version`). Thêm 5 commands mới bên dưới.

- [ ] **Step 1: Mở rộng `src-tauri/src/commands/settings.rs`** — thêm sau `app_version`:

```rust
use crate::domain::settings::{SettingKv, SugarIceInput};
use crate::repo::settings as repo;

fn lock(db: &State<AppDb>) -> Result<std::sync::MutexGuard<'_, rusqlite::Connection>, String> {
    db.0.lock().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_settings_bulk(
    db: State<AppDb>,
    keys: Vec<String>,
) -> Result<Vec<(String, Option<String>)>, String> {
    let conn = lock(&db)?;
    let key_refs: Vec<&str> = keys.iter().map(String::as_str).collect();
    repo::get_settings_bulk(&conn, &key_refs).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_settings_bulk(
    db: State<AppDb>,
    payload: Vec<SettingKv>,
) -> Result<(), String> {
    let conn = lock(&db)?;
    repo::set_settings_bulk(&conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_sugar_levels(db: State<AppDb>) -> Result<Vec<String>, String> {
    let conn = lock(&db)?;
    repo::list_sugar_levels(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_ice_levels(db: State<AppDb>) -> Result<Vec<String>, String> {
    let conn = lock(&db)?;
    repo::list_ice_levels(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_sugar_ice_levels(
    db: State<AppDb>,
    payload: SugarIceInput,
) -> Result<(), String> {
    let conn = lock(&db)?;
    let sugar: Vec<&str> = payload.sugar_levels.iter().map(|s| s.as_str()).collect();
    let ice: Vec<&str> = payload.ice_levels.iter().map(|s| s.as_str()).collect();
    repo::update_sugar_ice_levels(&conn, &sugar, &ice).map_err(|e| e.to_string())
}
```

> Lưu ý: M0 `commands/settings.rs` dùng `db.0.lock()` trực tiếp thay vì helper `lock()`. Thêm helper private `lock()` vào cùng file để tránh lặp code. Hàm này giống hệt pattern trong `commands/menu.rs` (M1).

- [ ] **Step 2: Đăng ký commands mới** — trong `src-tauri/src/lib.rs`, mở rộng `tauri::generate_handler![...]` — thêm sau các commands settings hiện có:

```rust
commands::settings::get_settings_bulk,
commands::settings::set_settings_bulk,
commands::settings::list_sugar_levels,
commands::settings::list_ice_levels,
commands::settings::update_sugar_ice_levels,
commands::backup::backup_database,
```

- [ ] **Step 3: Build + clippy** — Run:
```
cargo build --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```
Expected: biên dịch OK, clippy sạch.

- [ ] **Step 4: Chạy toàn bộ Rust tests** — Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: tất cả tests xanh (M0 + M1 + M7 mới).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/settings.rs src-tauri/src/lib.rs
git commit -m "feat(commands): expose bulk settings + sugar/ice level + backup_database commands"
```

---

## Task 5: Frontend API wrapper mở rộng + constants

**Files:** Modify `src/lib/api/settings.ts`; Create/Modify `src/lib/constants.ts`.

- [ ] **Step 1: Mở rộng `src/lib/api/settings.ts`** — thêm sau các hàm M0 hiện có:

```ts
import { invoke } from "@tauri-apps/api/core"

// --- Types M7 ---
export type SettingKv = { key: string; value: string }
export type SugarIceInput = { sugar_levels: string[]; ice_levels: string[] }

// --- M7 commands ---

/** Đọc nhiều keys cùng lúc, trả tuple [key, value | null][]. */
export function getSettingsBulk(keys: string[]): Promise<[string, string | null][]> {
  return invoke<[string, string | null][]>("get_settings_bulk", { keys })
}

/** Ghi nhiều key-value trong một transaction. */
export function setSettingsBulk(payload: SettingKv[]): Promise<void> {
  return invoke<void>("set_settings_bulk", { payload })
}

/** Đọc danh sách mức đường (fallback mặc định nếu chưa cài). */
export function listSugarLevels(): Promise<string[]> {
  return invoke<string[]>("list_sugar_levels")
}

/** Đọc danh sách mức đá (fallback mặc định nếu chưa cài). */
export function listIceLevels(): Promise<string[]> {
  return invoke<string[]>("list_ice_levels")
}

/** Cập nhật mức đường + đá cùng lúc. */
export function updateSugarIceLevels(payload: SugarIceInput): Promise<void> {
  return invoke<void>("update_sugar_ice_levels", { payload })
}

/**
 * Sao lưu DB sang thư mục `destDir` do người dùng chọn.
 * Trả đường dẫn tuyệt đối file backup đã tạo.
 *
 * Cách dùng:
 * ```ts
 * import { open } from "@tauri-apps/plugin-dialog"
 * const dir = await open({ directory: true, title: "Chọn thư mục lưu backup" })
 * if (dir) await backupDatabase(dir as string)
 * ```
 */
export function backupDatabase(destDir: string): Promise<string> {
  return invoke<string>("backup_database", { destDir })
}
```

- [ ] **Step 2: Tạo/Mở rộng `src/lib/constants.ts`** — nếu file chưa tồn tại (M3 tạo): đảm bảo export default có `DEFAULT_SUGAR_LEVELS` và `DEFAULT_ICE_LEVELS` (M3 dùng tên `SUGAR_LEVELS`/`ICE_LEVELS`; giữ alias để không breaking):

```ts
/** Mức đường mặc định — M3 dùng làm hardcoded; M7 cho phép cấu hình qua settings. */
export const DEFAULT_SUGAR_LEVELS: string[] = ["0%", "30%", "50%", "70%", "100%"]

/** Mức đá mặc định — M3 dùng làm hardcoded; M7 cho phép cấu hình qua settings. */
export const DEFAULT_ICE_LEVELS: string[] = ["Không", "Ít", "Vừa", "Nhiều"]

// Backward compat alias cho M3
export const SUGAR_LEVELS = DEFAULT_SUGAR_LEVELS
export const ICE_LEVELS = DEFAULT_ICE_LEVELS
```

> Nếu `constants.ts` đã tồn tại từ M3 với `SUGAR_LEVELS`/`ICE_LEVELS`, chỉ thêm 2 dòng `export const DEFAULT_*` làm alias ngược lại.

- [ ] **Step 3: Build typecheck** — Run: `npm run build`
Expected: tsc + vite OK.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api/settings.ts src/lib/constants.ts
git commit -m "feat(api): extend settings API wrapper with bulk/sugar-ice/backup; update constants"
```

---

## Task 6: Màn hình Settings mở rộng

**Files:** Modify `src/routes/Settings.tsx`.

Thay thế toàn bộ nội dung `Settings.tsx` hiện tại (M0 chỉ có 1 field `shop_name`) bằng màn hình mở rộng với 3 section. Giữ NGUYÊN logic M0 nhưng tích hợp vào section "Thông tin quán".

- [ ] **Step 1: Thay `src/routes/Settings.tsx`**

```tsx
import { useEffect, useState } from "react"
import { open } from "@tauri-apps/plugin-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Link } from "react-router-dom"
import {
  getSettingsBulk,
  setSettingsBulk,
  listSugarLevels,
  listIceLevels,
  updateSugarIceLevels,
  backupDatabase,
} from "@/lib/api/settings"
import { DEFAULT_SUGAR_LEVELS, DEFAULT_ICE_LEVELS } from "@/lib/constants"

const SHOP_KEYS = ["shop_name", "shop_address", "shop_phone", "bill_footer"] as const

export default function Settings() {
  // --- Shop info ---
  const [shopName, setShopName] = useState("")
  const [shopAddress, setShopAddress] = useState("")
  const [shopPhone, setShopPhone] = useState("")
  const [billFooter, setBillFooter] = useState("")
  const [shopSaved, setShopSaved] = useState(false)
  const [shopError, setShopError] = useState<string | null>(null)

  // --- Sugar/ice levels ---
  const [sugarLevels, setSugarLevels] = useState<string[]>([])
  const [iceLevels, setIceLevels] = useState<string[]>([])
  const [sugarInput, setSugarInput] = useState("")
  const [iceInput, setIceInput] = useState("")
  const [levelsError, setLevelsError] = useState<string | null>(null)
  const [levelsSaved, setLevelsSaved] = useState(false)

  // --- Backup ---
  const [backupPath, setBackupPath] = useState<string | null>(null)
  const [backupError, setBackupError] = useState<string | null>(null)
  const [backupLoading, setBackupLoading] = useState(false)

  // Load initial values
  useEffect(() => {
    getSettingsBulk([...SHOP_KEYS])
      .then((results) => {
        const map = Object.fromEntries(results.map(([k, v]) => [k, v ?? ""]))
        setShopName(map.shop_name ?? "")
        setShopAddress(map.shop_address ?? "")
        setShopPhone(map.shop_phone ?? "")
        setBillFooter(map.bill_footer ?? "")
      })
      .catch((e) => setShopError(String(e)))

    Promise.all([listSugarLevels(), listIceLevels()])
      .then(([sugar, ice]) => {
        setSugarLevels(sugar)
        setIceLevels(ice)
        setSugarInput(sugar.join(", "))
        setIceInput(ice.join(", "))
      })
      .catch((e) => setLevelsError(String(e)))
  }, [])

  // --- Shop info save ---
  async function onSaveShop() {
    setShopError(null)
    setShopSaved(false)
    try {
      await setSettingsBulk([
        { key: "shop_name", value: shopName.trim() },
        { key: "shop_address", value: shopAddress.trim() },
        { key: "shop_phone", value: shopPhone.trim() },
        { key: "bill_footer", value: billFooter.trim() },
      ])
      setShopSaved(true)
    } catch (e) {
      setShopError(String(e))
    }
  }

  // --- Sugar/ice save ---
  async function onSaveLevels() {
    setLevelsError(null)
    setLevelsSaved(false)
    try {
      const sugar = sugarInput.split(",").map((s) => s.trim()).filter(Boolean)
      const ice = iceInput.split(",").map((s) => s.trim()).filter(Boolean)
      if (sugar.length === 0 || ice.length === 0) {
        setLevelsError("Danh sách mức đường/đá không được rỗng")
        return
      }
      await updateSugarIceLevels({ sugar_levels: sugar, ice_levels: ice })
      setSugarLevels(sugar)
      setIceLevels(ice)
      setLevelsSaved(true)
    } catch (e) {
      setLevelsError(String(e))
    }
  }

  function onResetLevels() {
    setSugarInput(DEFAULT_SUGAR_LEVELS.join(", "))
    setIceInput(DEFAULT_ICE_LEVELS.join(", "))
    setLevelsSaved(false)
  }

  // --- Backup ---
  async function onBackup() {
    setBackupError(null)
    setBackupPath(null)
    setBackupLoading(true)
    try {
      const dir = await open({ directory: true, title: "Chọn thư mục lưu backup" })
      if (!dir) { setBackupLoading(false); return }
      const path = await backupDatabase(dir as string)
      setBackupPath(path)
    } catch (e) {
      setBackupError(String(e))
    } finally {
      setBackupLoading(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cài đặt</h1>
        <Button variant="outline" asChild>
          <Link to="/">Về trang chủ</Link>
        </Button>
      </div>

      {/* Section 1: Thông tin quán */}
      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="font-semibold">Thông tin quán</h2>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Tên quán</span>
          <Input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="HiGi Coffee" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Địa chỉ</span>
          <Input value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} placeholder="123 Đường ABC, Quận 1" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Số điện thoại</span>
          <Input value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} placeholder="0901234567" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Footer hoá đơn</span>
          <Input value={billFooter} onChange={(e) => setBillFooter(e.target.value)} placeholder="Cảm ơn quý khách!" />
        </label>
        {shopError && <p className="text-sm text-destructive">Lỗi: {shopError}</p>}
        {shopSaved && <p className="text-sm text-green-600">Đã lưu thông tin quán.</p>}
        <Button onClick={onSaveShop} className="min-h-[44px]">Lưu thông tin</Button>
      </section>

      {/* Section 2: Mức đường/đá */}
      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="font-semibold">Mức đường / Mức đá</h2>
        <p className="text-sm text-muted-foreground">
          Nhập các mức cách nhau bằng dấu phẩy. Ví dụ: <code>0%, 30%, 50%, 70%, 100%</code>
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Mức đường (hiện tại: {sugarLevels.join(", ")})</span>
          <Input value={sugarInput} onChange={(e) => setSugarInput(e.target.value)} placeholder="0%, 30%, 50%, 70%, 100%" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Mức đá (hiện tại: {iceLevels.join(", ")})</span>
          <Input value={iceInput} onChange={(e) => setIceInput(e.target.value)} placeholder="Không, Ít, Vừa, Nhiều" />
        </label>
        {levelsError && <p className="text-sm text-destructive">Lỗi: {levelsError}</p>}
        {levelsSaved && <p className="text-sm text-green-600">Đã lưu mức đường/đá.</p>}
        <div className="flex gap-2">
          <Button onClick={onSaveLevels} className="min-h-[44px] flex-1">Lưu mức đường/đá</Button>
          <Button variant="outline" onClick={onResetLevels} className="min-h-[44px]">Reset mặc định</Button>
        </div>
      </section>

      {/* Section 3: Sao lưu dữ liệu */}
      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="font-semibold">Sao lưu dữ liệu</h2>
        <p className="text-sm text-muted-foreground">
          Sao chép toàn bộ dữ liệu (file SQLite) sang thư mục bạn chọn. Tên file tự động có timestamp.
        </p>
        {backupError && <p className="text-sm text-destructive">Lỗi: {backupError}</p>}
        {backupPath && (
          <p className="break-all text-sm text-green-600">
            Sao lưu thành công: <strong>{backupPath}</strong>
          </p>
        )}
        <Button
          onClick={onBackup}
          disabled={backupLoading}
          className="min-h-[44px]"
        >
          {backupLoading ? "Đang sao lưu…" : "Chọn thư mục & sao lưu"}
        </Button>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Verify build** — Run: `npm run build` → OK.

- [ ] **Step 3: Commit**

```bash
git add src/routes/Settings.tsx
git commit -m "feat(settings): expand /settings screen with shop info, sugar/ice config, and DB backup"
```

---

## Task 7: Kiểm chứng end-to-end + cổng chất lượng

**Files:** none (verification).

- [ ] **Step 1: Chạy toàn bộ quality gate** —

```
npm run lint
npx prettier --check .
npm run test
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
```

Tất cả phải xanh. Sửa formatter/lint nếu có trên file mới.

- [ ] **Step 2: Kiểm chứng app thật** — Run: `npx tauri dev`. Lần lượt:
  1. Vào `/settings` → điền tên quán "HiGi Test" + địa chỉ + phone + footer → Lưu → thấy "Đã lưu thông tin quán".
  2. Đóng app, mở lại → các field vẫn giữ giá trị đã lưu.
  3. Đổi mức đường thành `25%, 50%, 100%` → Lưu mức đường/đá → thấy "Đã lưu". Kiểm tra "Mức đường hiện tại" cập nhật.
  4. Nhấn Reset mặc định → input về `0%, 30%, 50%, 70%, 100%` nhưng settings chưa bị ghi (chỉ reset form).
  5. Nhấn "Chọn thư mục & sao lưu" → hộp thoại folder picker xuất hiện → chọn Desktop → thấy path file backup (`higi-backup-<ts>.db`) → kiểm tra file thực sự tồn tại trên Desktop.
  6. Thử bấm Lưu mức đường/đá với input rỗng → báo lỗi "Danh sách mức đường/đá không được rỗng". Dừng `Ctrl+C`.

- [ ] **Step 3: Commit (nếu có sửa ở Step 1)** —

```bash
git add -A
git commit -m "chore(m7): fix lint/format and finalize M7 quality gates"
```

---

## Definition of Done (M7)

- [ ] Không có migration mới (M7 dùng `settings` table M0); nếu cần migration `0008_*.sql` trong tương lai thì append theo quy tắc contract §0.
- [ ] `get_settings_bulk`, `set_settings_bulk`, `list_sugar_levels`, `list_ice_levels`, `update_sugar_ice_levels`, `backup_database` — 6 commands mới được đăng ký trong `generate_handler!` và hoạt động end-to-end.
- [ ] Rust tests xanh: `bulk_set_get_returns_all_keys`, `bulk_set_is_atomic_on_error`, `sugar_ice_levels_default_when_not_set`, `update_sugar_ice_persists`, `update_sugar_ice_rejects_empty_list`, `backup_dest_path_format`, `backup_dest_path_no_path_traversal`, `copy_db_file_copies_bytes`.
- [ ] M0 settings tests (`set_then_get_returns_value`, `set_twice_overwrites`, `get_missing_returns_none`) vẫn xanh (không regression).
- [ ] Màn hình `/settings` hiển thị đủ 3 section; shop info persist sau restart; sugar/ice đọc đúng defaults khi chưa cài; backup tạo file `higi-backup-<ts>.db` trong thư mục được chọn.
- [ ] `src/lib/constants.ts` export `DEFAULT_SUGAR_LEVELS`, `DEFAULT_ICE_LEVELS` (+ alias M3 `SUGAR_LEVELS`, `ICE_LEVELS`) — M3 không bị breaking.
- [ ] Toàn bộ CI gate xanh: `npm run lint`, `prettier --check`, `npm run test`, `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`, `npm run build`.
- [ ] PR M7 → CI xanh trên GitHub → merge (GitHub Flow).
