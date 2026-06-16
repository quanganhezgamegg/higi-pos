use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

use crate::db::AppDb;
use crate::domain::customer::{
    Bank, Branding, CustomerItemToppingView, CustomerOrderItemView, CustomerOrderView,
    CustomerPaymentView, CustomerPhase, CustomerView, PaymentQr,
};
use crate::domain::orders::OrderType;
use crate::repo::{orders, settings};
use crate::services::vietqr;

#[derive(Debug, Default)]
pub struct CustomerDisplayState {
    pub view: CustomerView,
    pub current_order_id: Option<i64>,
}

pub fn emit_customer_update_for_order(
    app: &AppHandle,
    db: &State<'_, AppDb>,
    cs: &State<'_, Mutex<CustomerDisplayState>>,
    touched_order_id: i64,
) -> Result<(), String> {
    let (current_order_id, phase) = {
        let guard = cs.lock().map_err(|e| e.to_string())?;
        (guard.current_order_id, guard.view.phase.clone())
    };
    if current_order_id != Some(touched_order_id) || matches!(phase, CustomerPhase::Idle) {
        return Ok(());
    }

    let rebuilt = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        rebuild_view(&conn, touched_order_id, &phase).map_err(|e| e.to_string())?
    };

    {
        let mut guard = cs.lock().map_err(|e| e.to_string())?;
        guard.view = rebuilt.clone();
    }

    app.emit("customer://update", &rebuilt)
        .map_err(|e| e.to_string())
}

pub fn rebuild_view(
    conn: &Connection,
    order_id: i64,
    phase: &CustomerPhase,
) -> rusqlite::Result<CustomerView> {
    let order = orders::get_order(conn, order_id)?;
    let table_name = if matches!(order.order_type, OrderType::DineIn) {
        order.table_id.and_then(|table_id| {
            conn.query_row("SELECT name FROM tables WHERE id=?1", [table_id], |row| {
                row.get::<_, String>(0)
            })
            .ok()
        })
    } else {
        None
    };

    let order_view = CustomerOrderView {
        code: order.code.clone(),
        r#type: order.order_type.clone(),
        table_name,
        items: order
            .items
            .iter()
            .map(|item| CustomerOrderItemView {
                name: item.product_name.clone(),
                size: item.size_name.clone(),
                sugar: item.sugar_level.clone(),
                ice: item.ice_level.clone(),
                qty: item.quantity,
                line_total: item.line_total,
                toppings: item
                    .toppings
                    .iter()
                    .map(|topping| CustomerItemToppingView {
                        name: topping.topping_name.clone(),
                        price: topping.price,
                    })
                    .collect(),
            })
            .collect(),
        subtotal: order.subtotal,
        discount_total: order.discount_total,
        total: order.total,
    };

    let payment = if matches!(phase, CustomerPhase::Payment) {
        build_payment_view(conn, order_id).ok()
    } else {
        None
    };

    Ok(CustomerView {
        phase: phase.clone(),
        order: if matches!(phase, CustomerPhase::Order | CustomerPhase::Payment) {
            Some(order_view)
        } else {
            None
        },
        payment,
    })
}

fn build_payment_view(conn: &Connection, order_id: i64) -> rusqlite::Result<CustomerPaymentView> {
    let qr = build_payment_qr(conn, order_id)?;
    Ok(CustomerPaymentView {
        qr_svg: qr.qr_svg,
        amount: qr.amount,
        content: qr.content,
        bank_name: qr.bank_name,
        account_number: qr.account_number,
    })
}

fn build_payment_qr(conn: &Connection, order_id: i64) -> rusqlite::Result<PaymentQr> {
    let order = orders::get_order(conn, order_id)?;
    let bank_bin = settings::get_setting(conn, "bank_bin")?.unwrap_or_default();
    let account_number = settings::get_setting(conn, "bank_account_number")?.unwrap_or_default();
    if bank_bin.trim().is_empty() || account_number.trim().is_empty() {
        return Err(rusqlite::Error::InvalidParameterName(
            "Chua cau hinh ngan hang cho VietQR".into(),
        ));
    }

    let content = format!("DH{}", order.code);
    let payload = vietqr::build_vietqr_payload(
        bank_bin.trim(),
        account_number.trim(),
        order.total,
        &content,
    );
    Ok(PaymentQr {
        qr_svg: vietqr::build_qr_svg(&payload),
        amount: order.total,
        content,
        bank_name: vietqr::bank_name_by_bin(bank_bin.trim()),
        account_number: account_number.trim().to_string(),
    })
}

fn parse_phase(value: &str) -> Result<CustomerPhase, String> {
    match value {
        "idle" => Ok(CustomerPhase::Idle),
        "order" => Ok(CustomerPhase::Order),
        "payment" => Ok(CustomerPhase::Payment),
        "thankyou" => Ok(CustomerPhase::ThankYou),
        _ => Err(format!("phase khong hop le: {value}")),
    }
}

fn emit_view(app: &AppHandle, view: &CustomerView) -> Result<(), String> {
    app.emit("customer://update", view)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_customer_display(app: AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("customer") {
        let _ = existing.close();
    }

    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let primary = app.primary_monitor().map_err(|e| e.to_string())?;
    let secondary = primary.as_ref().and_then(|primary| {
        monitors
            .iter()
            .find(|monitor| monitor.position() != primary.position())
    });

    let builder = WebviewWindowBuilder::new(
        &app,
        "customer",
        WebviewUrl::App("index.html#/customer".into()),
    )
    .title("HiGi - Man hinh khach")
    .decorations(false)
    .always_on_top(true);

    if let Some(monitor) = secondary {
        let pos = monitor.position();
        let size = monitor.size();
        builder
            .position(pos.x as f64, pos.y as f64)
            .inner_size(size.width as f64, size.height as f64)
            .fullscreen(true)
            .build()
            .map_err(|e| e.to_string())?;
    } else {
        builder
            .inner_size(1024.0, 600.0)
            .center()
            .build()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn close_customer_display(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("customer") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_customer_view(
    cs: State<'_, Mutex<CustomerDisplayState>>,
) -> Result<CustomerView, String> {
    let guard = cs.lock().map_err(|e| e.to_string())?;
    Ok(guard.view.clone())
}

#[tauri::command]
pub fn set_customer_order(
    app: AppHandle,
    db: State<'_, AppDb>,
    cs: State<'_, Mutex<CustomerDisplayState>>,
    order_id: i64,
    phase: String,
) -> Result<(), String> {
    let phase = parse_phase(&phase)?;
    if matches!(phase, CustomerPhase::Idle | CustomerPhase::ThankYou) {
        return set_customer_phase(app, db, cs, phase_to_str(&phase).to_string());
    }

    let rebuilt = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        rebuild_view(&conn, order_id, &phase).map_err(|e| e.to_string())?
    };

    {
        let mut guard = cs.lock().map_err(|e| e.to_string())?;
        guard.current_order_id = Some(order_id);
        guard.view = rebuilt.clone();
    }
    emit_view(&app, &rebuilt)
}

#[tauri::command]
pub fn set_customer_phase(
    app: AppHandle,
    db: State<'_, AppDb>,
    cs: State<'_, Mutex<CustomerDisplayState>>,
    phase: String,
) -> Result<(), String> {
    let phase = parse_phase(&phase)?;
    if matches!(phase, CustomerPhase::Idle) {
        let view = CustomerView::default();
        {
            let mut guard = cs.lock().map_err(|e| e.to_string())?;
            guard.current_order_id = None;
            guard.view = view.clone();
        }
        return emit_view(&app, &view);
    }

    if matches!(phase, CustomerPhase::ThankYou) {
        let view = CustomerView {
            phase,
            order: None,
            payment: None,
        };
        {
            let mut guard = cs.lock().map_err(|e| e.to_string())?;
            guard.view = view.clone();
        }
        return emit_view(&app, &view);
    }

    let order_id = {
        let guard = cs.lock().map_err(|e| e.to_string())?;
        guard
            .current_order_id
            .ok_or_else(|| "Chua chon don cho man hinh khach".to_string())?
    };
    let rebuilt = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        rebuild_view(&conn, order_id, &phase).map_err(|e| e.to_string())?
    };
    {
        let mut guard = cs.lock().map_err(|e| e.to_string())?;
        guard.view = rebuilt.clone();
    }
    emit_view(&app, &rebuilt)
}

#[tauri::command]
pub fn get_payment_qr(db: State<'_, AppDb>, order_id: i64) -> Result<PaymentQr, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    build_payment_qr(&conn, order_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_banks() -> Vec<Bank> {
    vietqr::list_banks()
}

#[tauri::command]
pub fn get_branding(db: State<'_, AppDb>) -> Result<Branding, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    Ok(branding_from_settings(&conn))
}

pub fn branding_from_settings(conn: &Connection) -> Branding {
    let get = |key: &str| {
        settings::get_setting(conn, key)
            .ok()
            .flatten()
            .unwrap_or_default()
    };
    let promo_images =
        serde_json::from_str::<Vec<String>>(&get("promo_images")).unwrap_or_default();
    let mut branding = Branding::default();
    let shop_name = get("shop_name");
    let shop_address = get("shop_address");
    let shop_phone = get("shop_phone");
    let brand_color = get("brand_color");
    let logo_path = get("logo_path");
    let idle_bg_path = get("idle_bg_path");
    let welcome = get("customer_welcome_text");
    let bill_footer = get("bill_footer");

    if !shop_name.trim().is_empty() {
        branding.shop_name = shop_name;
    }
    branding.shop_address = shop_address;
    branding.shop_phone = shop_phone;
    if !brand_color.trim().is_empty() {
        branding.brand_color = brand_color;
    }
    branding.logo_path = (!logo_path.trim().is_empty()).then_some(logo_path);
    branding.idle_bg_path = (!idle_bg_path.trim().is_empty()).then_some(idle_bg_path);
    branding.promo_images = promo_images;
    if !welcome.trim().is_empty() {
        branding.customer_welcome_text = welcome;
    }
    if !bill_footer.trim().is_empty() {
        branding.bill_footer = bill_footer;
    }
    branding
}

#[tauri::command]
pub fn save_branding_image(
    app: AppHandle,
    source_path: String,
    _kind: String,
) -> Result<String, String> {
    crate::commands::image::save_product_image(app, source_path)
}

fn phase_to_str(phase: &CustomerPhase) -> &'static str {
    match phase {
        CustomerPhase::Idle => "idle",
        CustomerPhase::Order => "order",
        CustomerPhase::Payment => "payment",
        CustomerPhase::ThankYou => "thankyou",
    }
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::*;
    use crate::db::migrations;
    use crate::domain::orders::{CreateOrderInput, OrderItemInput};

    fn conn() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        migrations::run(&mut conn).unwrap();
        conn
    }

    fn order_id(conn: &Connection) -> i64 {
        let order = orders::create_order(
            conn,
            CreateOrderInput {
                order_type: OrderType::Takeaway,
                table_id: None,
                note: None,
            },
        )
        .unwrap();
        orders::add_order_item(
            conn,
            order.id,
            OrderItemInput {
                product_id: None,
                product_name: "Ca phe sua".into(),
                size_name: None,
                unit_price: 30_000,
                quantity: 1,
                sugar_level: None,
                ice_level: None,
                line_note: None,
                line_discount: 0,
                toppings: vec![],
            },
        )
        .unwrap()
        .id
    }

    #[test]
    fn payment_view_without_bank_config_keeps_order_without_qr() {
        let conn = conn();
        let order_id = order_id(&conn);

        let view = rebuild_view(&conn, order_id, &CustomerPhase::Payment).unwrap();

        assert_eq!(view.phase, CustomerPhase::Payment);
        assert!(view.order.is_some());
        assert!(view.payment.is_none());
    }
}
