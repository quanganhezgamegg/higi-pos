use std::sync::Mutex;

use tauri::{AppHandle, Manager, State};

use crate::commands::customer::{
    emit_customer_update_for_order, set_customer_phase, CustomerDisplayState,
};
use crate::db::AppDb;
use crate::domain::orders::Order;
use crate::domain::payments::{ApplyDiscountInput, Discount, DiscountInput, PaymentInput};
use crate::repo::payments;

fn lock<'a>(
    db: &'a State<'_, AppDb>,
) -> Result<std::sync::MutexGuard<'a, rusqlite::Connection>, String> {
    db.0.lock().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_discounts(db: State<AppDb>, include_inactive: bool) -> Result<Vec<Discount>, String> {
    let conn = lock(&db)?;
    payments::list_discounts(&conn, include_inactive).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_discount(db: State<AppDb>, payload: DiscountInput) -> Result<Discount, String> {
    let conn = lock(&db)?;
    payments::create_discount(&conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_discount(
    db: State<AppDb>,
    id: i64,
    payload: DiscountInput,
) -> Result<Discount, String> {
    let conn = lock(&db)?;
    payments::update_discount(&conn, id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_discount_active(db: State<AppDb>, id: i64, is_active: bool) -> Result<(), String> {
    let conn = lock(&db)?;
    payments::set_discount_active(&conn, id, is_active).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn apply_discount(
    app: AppHandle,
    db: State<AppDb>,
    cs: State<'_, Mutex<CustomerDisplayState>>,
    order_id: i64,
    payload: ApplyDiscountInput,
) -> Result<Order, String> {
    let order = {
        let conn = lock(&db)?;
        payments::apply_discount(&conn, order_id, payload).map_err(|e| e.to_string())?
    };
    emit_customer_update_for_order(&app, &db, &cs, order.id)?;
    Ok(order)
}

#[tauri::command]
pub fn remove_order_discount(
    app: AppHandle,
    db: State<AppDb>,
    cs: State<'_, Mutex<CustomerDisplayState>>,
    order_discount_id: i64,
) -> Result<Order, String> {
    let order = {
        let conn = lock(&db)?;
        payments::remove_order_discount(&conn, order_discount_id).map_err(|e| e.to_string())?
    };
    emit_customer_update_for_order(&app, &db, &cs, order.id)?;
    Ok(order)
}

#[tauri::command]
pub fn add_payment(
    app: AppHandle,
    db: State<AppDb>,
    cs: State<'_, Mutex<CustomerDisplayState>>,
    order_id: i64,
    payload: PaymentInput,
) -> Result<Order, String> {
    let order = {
        let conn = lock(&db)?;
        payments::add_payment(&conn, order_id, payload).map_err(|e| e.to_string())?
    };
    emit_customer_update_for_order(&app, &db, &cs, order.id)?;
    Ok(order)
}

#[tauri::command]
pub fn finalize_order(
    app: AppHandle,
    db: State<AppDb>,
    cs: State<'_, Mutex<CustomerDisplayState>>,
    order_id: i64,
) -> Result<Order, String> {
    let order = {
        let conn = lock(&db)?;
        payments::finalize_order(&conn, order_id).map_err(|e| e.to_string())?
    };
    set_customer_phase(app, db, cs, "thankyou".into())?;
    Ok(order)
}

#[tauri::command]
pub fn generate_bill_html(
    app: AppHandle,
    db: State<AppDb>,
    order_id: i64,
) -> Result<String, String> {
    let conn = lock(&db)?;
    let app_data_dir = app.path().app_data_dir().ok();
    payments::generate_bill_html(&conn, order_id, app_data_dir.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn generate_bill_pdf(db: State<AppDb>, order_id: i64) -> Result<String, String> {
    let conn = lock(&db)?;
    payments::generate_bill_pdf(&conn, order_id).map_err(|e| e.to_string())
}
