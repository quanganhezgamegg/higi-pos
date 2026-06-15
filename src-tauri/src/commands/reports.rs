use tauri::State;

use crate::db::AppDb;
use crate::domain::reports::{PaymentMixRow, ReportRangeInput, SalesSummary, TopProductRow};
use crate::repo::reports;

fn lock<'a>(
    db: &'a State<'_, AppDb>,
) -> Result<std::sync::MutexGuard<'a, rusqlite::Connection>, String> {
    db.0.lock().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn report_sales_summary(
    db: State<AppDb>,
    payload: ReportRangeInput,
) -> Result<SalesSummary, String> {
    let conn = lock(&db)?;
    reports::report_sales_summary(&conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn report_payment_mix(
    db: State<AppDb>,
    payload: ReportRangeInput,
) -> Result<Vec<PaymentMixRow>, String> {
    let conn = lock(&db)?;
    reports::report_payment_mix(&conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn report_top_products(
    db: State<AppDb>,
    payload: ReportRangeInput,
    limit: i64,
) -> Result<Vec<TopProductRow>, String> {
    let conn = lock(&db)?;
    reports::report_top_products(&conn, payload, limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn report_discount_total(db: State<AppDb>, payload: ReportRangeInput) -> Result<i64, String> {
    let conn = lock(&db)?;
    reports::report_discount_total(&conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn report_shift_summary(db: State<AppDb>, shift_id: i64) -> Result<SalesSummary, String> {
    let conn = lock(&db)?;
    reports::report_shift_summary(&conn, shift_id).map_err(|e| e.to_string())
}
