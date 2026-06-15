use rusqlite::{params, Connection};

use crate::domain::payments::*;
use crate::repo::{orders, settings};
use crate::services::payment;

fn now_iso(conn: &Connection) -> rusqlite::Result<String> {
    conn.query_row("SELECT strftime('%Y-%m-%dT%H:%M:%SZ','now')", [], |row| {
        row.get(0)
    })
}

fn discount_type_to_str(value: &DiscountType) -> &'static str {
    match value {
        DiscountType::Percent => "PERCENT",
        DiscountType::Amount => "AMOUNT",
    }
}

fn discount_scope_to_str(value: &DiscountScope) -> &'static str {
    match value {
        DiscountScope::Order => "ORDER",
        DiscountScope::Item => "ITEM",
    }
}

fn payment_method_to_str(value: &PaymentMethod) -> &'static str {
    match value {
        PaymentMethod::Cash => "CASH",
        PaymentMethod::Qr => "QR",
    }
}

fn parse_discount_type(value: String) -> rusqlite::Result<DiscountType> {
    match value.as_str() {
        "PERCENT" => Ok(DiscountType::Percent),
        "AMOUNT" => Ok(DiscountType::Amount),
        _ => Err(rusqlite::Error::InvalidParameterName(format!(
            "discount type không hợp lệ: {value}"
        ))),
    }
}

fn parse_discount_scope(value: String) -> rusqlite::Result<DiscountScope> {
    match value.as_str() {
        "ORDER" => Ok(DiscountScope::Order),
        "ITEM" => Ok(DiscountScope::Item),
        _ => Err(rusqlite::Error::InvalidParameterName(format!(
            "discount scope không hợp lệ: {value}"
        ))),
    }
}

fn row_to_discount(row: &rusqlite::Row) -> rusqlite::Result<Discount> {
    Ok(Discount {
        id: row.get("id")?,
        name: row.get("name")?,
        r#type: parse_discount_type(row.get("type")?)?,
        value: row.get("value")?,
        scope: parse_discount_scope(row.get("scope")?)?,
        is_active: row.get::<_, i64>("is_active")? != 0,
        valid_from: row.get("valid_from")?,
        valid_to: row.get("valid_to")?,
        sort_order: row.get("sort_order")?,
    })
}

fn load_discount(conn: &Connection, id: i64) -> rusqlite::Result<Discount> {
    conn.query_row("SELECT * FROM discounts WHERE id=?1", [id], row_to_discount)
}

fn validate_discount(input: &DiscountInput) -> rusqlite::Result<()> {
    if input.name.trim().is_empty() || input.value < 0 {
        return Err(rusqlite::Error::InvalidParameterName(
            "Chiết khấu không hợp lệ".into(),
        ));
    }
    if matches!(input.r#type, DiscountType::Percent) && input.value > 100 {
        return Err(rusqlite::Error::InvalidParameterName(
            "Chiết khấu phần trăm phải từ 0 đến 100".into(),
        ));
    }
    Ok(())
}

pub fn list_discounts(
    conn: &Connection,
    include_inactive: bool,
) -> rusqlite::Result<Vec<Discount>> {
    let sql = if include_inactive {
        "SELECT * FROM discounts ORDER BY sort_order, id"
    } else {
        "SELECT * FROM discounts WHERE is_active=1 ORDER BY sort_order, id"
    };
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([], row_to_discount)?;
    rows.collect()
}

pub fn create_discount(conn: &Connection, input: DiscountInput) -> rusqlite::Result<Discount> {
    validate_discount(&input)?;
    conn.execute(
        "INSERT INTO discounts(name, type, value, scope, valid_from, valid_to, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            input.name.trim(),
            discount_type_to_str(&input.r#type),
            input.value,
            discount_scope_to_str(&input.scope),
            input.valid_from,
            input.valid_to,
            input.sort_order
        ],
    )?;
    load_discount(conn, conn.last_insert_rowid())
}

pub fn update_discount(
    conn: &Connection,
    id: i64,
    input: DiscountInput,
) -> rusqlite::Result<Discount> {
    validate_discount(&input)?;
    conn.execute(
        "UPDATE discounts
         SET name=?2, type=?3, value=?4, scope=?5, valid_from=?6, valid_to=?7, sort_order=?8
         WHERE id=?1",
        params![
            id,
            input.name.trim(),
            discount_type_to_str(&input.r#type),
            input.value,
            discount_scope_to_str(&input.scope),
            input.valid_from,
            input.valid_to,
            input.sort_order
        ],
    )?;
    load_discount(conn, id)
}

pub fn set_discount_active(conn: &Connection, id: i64, is_active: bool) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE discounts SET is_active=?2 WHERE id=?1",
        params![id, is_active as i64],
    )?;
    Ok(())
}

pub fn apply_discount(
    conn: &Connection,
    order_id: i64,
    input: ApplyDiscountInput,
) -> rusqlite::Result<crate::domain::orders::Order> {
    let name = input.name.trim();
    if name.is_empty() || input.value < 0 {
        return Err(rusqlite::Error::InvalidParameterName(
            "Chiết khấu không hợp lệ".into(),
        ));
    }
    if matches!(input.r#type, DiscountType::Percent) && input.value > 100 {
        return Err(rusqlite::Error::InvalidParameterName(
            "Chiết khấu phần trăm phải từ 0 đến 100".into(),
        ));
    }

    conn.execute_batch("BEGIN")?;
    let result = (|| {
        conn.execute(
            "INSERT INTO order_discounts(order_id, discount_id, name, type, value, amount_applied)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
            params![
                order_id,
                input.discount_id,
                name,
                discount_type_to_str(&input.r#type),
                input.value
            ],
        )?;
        orders::recompute_order_totals(conn, order_id)?;
        Ok::<(), rusqlite::Error>(())
    })();
    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT")?;
            orders::get_order(conn, order_id)
        }
        Err(error) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(error)
        }
    }
}

pub fn remove_order_discount(
    conn: &Connection,
    order_discount_id: i64,
) -> rusqlite::Result<crate::domain::orders::Order> {
    let order_id: i64 = conn.query_row(
        "SELECT order_id FROM order_discounts WHERE id=?1",
        [order_discount_id],
        |row| row.get(0),
    )?;
    conn.execute_batch("BEGIN")?;
    let result = (|| {
        conn.execute(
            "DELETE FROM order_discounts WHERE id=?1",
            [order_discount_id],
        )?;
        orders::recompute_order_totals(conn, order_id)?;
        Ok::<(), rusqlite::Error>(())
    })();
    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT")?;
            orders::get_order(conn, order_id)
        }
        Err(error) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(error)
        }
    }
}

pub fn add_payment(
    conn: &Connection,
    order_id: i64,
    input: PaymentInput,
) -> rusqlite::Result<crate::domain::orders::Order> {
    if input.amount < 0 {
        return Err(rusqlite::Error::InvalidParameterName(
            "Số tiền thanh toán không hợp lệ".into(),
        ));
    }
    let change_due = match input.method {
        PaymentMethod::Cash => {
            let tendered = input.tendered.unwrap_or(input.amount);
            Some(
                payment::compute_change_due(tendered, input.amount)
                    .map_err(rusqlite::Error::InvalidParameterName)?,
            )
        }
        PaymentMethod::Qr => None,
    };
    conn.execute(
        "INSERT INTO payments(order_id, method, amount, tendered, change_due, paid_at, ref_note)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            order_id,
            payment_method_to_str(&input.method),
            input.amount,
            input.tendered,
            change_due,
            now_iso(conn)?,
            input.ref_note
        ],
    )?;
    orders::get_order(conn, order_id)
}

pub fn finalize_order(
    conn: &Connection,
    order_id: i64,
) -> rusqlite::Result<crate::domain::orders::Order> {
    let order = orders::get_order(conn, order_id)?;
    let payments_total: i64 = order.payments.iter().map(|payment| payment.amount).sum();
    payment::validate_finalize(payments_total, order.total)
        .map_err(rusqlite::Error::InvalidParameterName)?;
    orders::mark_paid(conn, order_id)
}

pub fn generate_bill_html(conn: &Connection, order_id: i64) -> rusqlite::Result<String> {
    let order = orders::get_order(conn, order_id)?;
    let shop_name = settings::get_setting(conn, "shop_name")?.unwrap_or_else(|| "HiGi POS".into());
    let shop_address = settings::get_setting(conn, "shop_address")?.unwrap_or_default();
    let shop_phone = settings::get_setting(conn, "shop_phone")?.unwrap_or_default();
    let footer =
        settings::get_setting(conn, "bill_footer")?.unwrap_or_else(|| "Cảm ơn quý khách".into());
    let rows = order
        .items
        .iter()
        .map(|item| {
            format!(
                "<tr><td>{} x{}</td><td style=\"text-align:right\">{}</td></tr>",
                html_escape(&item.product_name),
                item.quantity,
                item.line_total
            )
        })
        .collect::<String>();
    Ok(format!(
        r#"<!doctype html>
<html><head><meta charset="utf-8"><title>Bill {code}</title>
<style>
body {{ font-family: Arial, sans-serif; max-width: 320px; margin: 0 auto; color: #111; }}
h1 {{ font-size: 18px; text-align: center; margin: 8px 0; }}
p {{ margin: 4px 0; font-size: 12px; }}
table {{ width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }}
td {{ border-bottom: 1px dashed #ccc; padding: 6px 0; }}
.total {{ font-size: 16px; font-weight: bold; }}
@media print {{ body {{ margin: 0; }} button {{ display: none; }} }}
</style></head>
<body>
<h1>{shop_name}</h1>
<p>{shop_address}</p>
<p>{shop_phone}</p>
<p>Đơn: {code}</p>
<p>Thời gian: {paid_at}</p>
<table>{rows}</table>
<p>Tạm tính: {subtotal}</p>
<p>Giảm giá: {discount}</p>
<p class="total">Tổng: {total}</p>
<p style="text-align:center;margin-top:16px">{footer}</p>
</body></html>"#,
        code = html_escape(&order.code),
        shop_name = html_escape(&shop_name),
        shop_address = html_escape(&shop_address),
        shop_phone = html_escape(&shop_phone),
        rows = rows,
        subtotal = order.subtotal,
        discount = order.discount_total,
        total = order.total,
        paid_at = order.paid_at.unwrap_or(order.created_at),
        footer = html_escape(&footer)
    ))
}

pub fn generate_bill_pdf(_conn: &Connection, order_id: i64) -> rusqlite::Result<String> {
    Ok(format!("bill-{order_id}.pdf"))
}

fn html_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;
    use crate::domain::orders::{CreateOrderInput, OrderItemInput, OrderType};

    fn conn() -> Connection {
        let mut c = Connection::open_in_memory().unwrap();
        c.pragma_update(None, "foreign_keys", "ON").unwrap();
        migrations::run(&mut c).unwrap();
        c
    }

    fn order_with_item(c: &Connection) -> i64 {
        let order = orders::create_order(
            c,
            CreateOrderInput {
                order_type: OrderType::Takeaway,
                table_id: None,
                note: None,
            },
        )
        .unwrap();
        orders::add_order_item(
            c,
            order.id,
            OrderItemInput {
                product_id: None,
                product_name: "Bạc Xỉu".into(),
                size_name: None,
                unit_price: 25_000,
                quantity: 2,
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
    fn discount_crud() {
        let c = conn();
        let discount = create_discount(
            &c,
            DiscountInput {
                name: "Khai trương".into(),
                r#type: DiscountType::Percent,
                value: 10,
                scope: DiscountScope::Order,
                valid_from: None,
                valid_to: None,
                sort_order: 0,
            },
        )
        .unwrap();
        assert_eq!(discount.value, 10);
        assert_eq!(list_discounts(&c, false).unwrap().len(), 1);
        set_discount_active(&c, discount.id, false).unwrap();
        assert_eq!(list_discounts(&c, false).unwrap().len(), 0);
    }

    #[test]
    fn apply_discount_recomputes_order_total() {
        let c = conn();
        let order_id = order_with_item(&c);
        let order = apply_discount(
            &c,
            order_id,
            ApplyDiscountInput {
                discount_id: None,
                name: "Giảm 10%".into(),
                r#type: DiscountType::Percent,
                value: 10,
            },
        )
        .unwrap();
        assert_eq!(order.subtotal, 50_000);
        assert_eq!(order.discount_total, 5_000);
        assert_eq!(order.total, 45_000);
    }

    #[test]
    fn payment_and_finalize() {
        let c = conn();
        let order_id = order_with_item(&c);
        let order = add_payment(
            &c,
            order_id,
            PaymentInput {
                method: PaymentMethod::Cash,
                amount: 50_000,
                tendered: Some(100_000),
                ref_note: None,
            },
        )
        .unwrap();
        assert_eq!(order.payments[0].change_due, Some(50_000));
        let paid = finalize_order(&c, order_id).unwrap();
        assert_eq!(paid.status, crate::domain::orders::OrderStatus::Paid);
    }
}
