use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};

use crate::domain::orders::*;
use crate::domain::payments::{DiscountType, OrderDiscount, Payment, PaymentMethod};
use crate::repo::{settings, shifts};
use crate::services::{order, payment};

fn now_iso(conn: &Connection) -> rusqlite::Result<String> {
    conn.query_row("SELECT strftime('%Y-%m-%dT%H:%M:%SZ','now')", [], |row| {
        row.get(0)
    })
}

fn next_code() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or_default();
    format!("ORD-{millis}")
}

fn order_type_to_str(value: &OrderType) -> &'static str {
    match value {
        OrderType::DineIn => "DINE_IN",
        OrderType::Takeaway => "TAKEAWAY",
    }
}

fn order_status_to_str(value: &OrderStatus) -> &'static str {
    match value {
        OrderStatus::Open => "OPEN",
        OrderStatus::Paid => "PAID",
        OrderStatus::Cancelled => "CANCELLED",
    }
}

fn parse_order_type(value: String) -> rusqlite::Result<OrderType> {
    match value.as_str() {
        "DINE_IN" => Ok(OrderType::DineIn),
        "TAKEAWAY" => Ok(OrderType::Takeaway),
        _ => Err(rusqlite::Error::InvalidParameterName(format!(
            "order_type không hợp lệ: {value}"
        ))),
    }
}

fn parse_order_status(value: String) -> rusqlite::Result<OrderStatus> {
    match value.as_str() {
        "OPEN" => Ok(OrderStatus::Open),
        "PAID" => Ok(OrderStatus::Paid),
        "CANCELLED" => Ok(OrderStatus::Cancelled),
        _ => Err(rusqlite::Error::InvalidParameterName(format!(
            "status không hợp lệ: {value}"
        ))),
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

fn parse_payment_method(value: String) -> rusqlite::Result<PaymentMethod> {
    match value.as_str() {
        "CASH" => Ok(PaymentMethod::Cash),
        "QR" => Ok(PaymentMethod::Qr),
        _ => Err(rusqlite::Error::InvalidParameterName(format!(
            "payment method không hợp lệ: {value}"
        ))),
    }
}

fn row_to_order_base(row: &rusqlite::Row) -> rusqlite::Result<Order> {
    Ok(Order {
        id: row.get("id")?,
        code: row.get("code")?,
        order_type: parse_order_type(row.get("order_type")?)?,
        table_id: row.get("table_id")?,
        shift_id: row.get("shift_id")?,
        status: parse_order_status(row.get("status")?)?,
        subtotal: row.get("subtotal")?,
        discount_total: row.get("discount_total")?,
        total: row.get("total")?,
        note: row.get("note")?,
        created_at: row.get("created_at")?,
        paid_at: row.get("paid_at")?,
        items: Vec::new(),
        discounts: Vec::new(),
        payments: Vec::new(),
    })
}

fn load_toppings(conn: &Connection, item_id: i64) -> rusqlite::Result<Vec<OrderItemTopping>> {
    let mut stmt = conn.prepare(
        "SELECT id, order_item_id, topping_id, topping_name, price, quantity
         FROM order_item_toppings
         WHERE order_item_id=?1
         ORDER BY id",
    )?;
    let rows = stmt.query_map([item_id], |row| {
        Ok(OrderItemTopping {
            id: row.get("id")?,
            order_item_id: row.get("order_item_id")?,
            topping_id: row.get("topping_id")?,
            topping_name: row.get("topping_name")?,
            price: row.get("price")?,
            quantity: row.get("quantity")?,
        })
    })?;
    rows.collect()
}

fn load_items(conn: &Connection, order_id: i64) -> rusqlite::Result<Vec<OrderItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, order_id, product_id, product_name, size_name, unit_price, quantity,
                sugar_level, ice_level, line_note, line_discount, line_total
         FROM order_items
         WHERE order_id=?1
         ORDER BY id",
    )?;
    let rows = stmt.query_map([order_id], |row| {
        let id: i64 = row.get("id")?;
        Ok(OrderItem {
            id,
            order_id: row.get("order_id")?,
            product_id: row.get("product_id")?,
            product_name: row.get("product_name")?,
            size_name: row.get("size_name")?,
            unit_price: row.get("unit_price")?,
            quantity: row.get("quantity")?,
            sugar_level: row.get("sugar_level")?,
            ice_level: row.get("ice_level")?,
            line_note: row.get("line_note")?,
            line_discount: row.get("line_discount")?,
            line_total: row.get("line_total")?,
            toppings: load_toppings(conn, id)?,
        })
    })?;
    rows.collect()
}

fn load_discounts(conn: &Connection, order_id: i64) -> rusqlite::Result<Vec<OrderDiscount>> {
    let mut stmt = conn.prepare(
        "SELECT id, order_id, discount_id, name, type, value, amount_applied
         FROM order_discounts
         WHERE order_id=?1
         ORDER BY id",
    )?;
    let rows = stmt.query_map([order_id], |row| {
        Ok(OrderDiscount {
            id: row.get("id")?,
            order_id: row.get("order_id")?,
            discount_id: row.get("discount_id")?,
            name: row.get("name")?,
            r#type: parse_discount_type(row.get("type")?)?,
            value: row.get("value")?,
            amount_applied: row.get("amount_applied")?,
        })
    })?;
    rows.collect()
}

fn load_payments(conn: &Connection, order_id: i64) -> rusqlite::Result<Vec<Payment>> {
    let mut stmt = conn.prepare(
        "SELECT id, order_id, method, amount, tendered, change_due, paid_at, ref_note
         FROM payments
         WHERE order_id=?1
         ORDER BY id",
    )?;
    let rows = stmt.query_map([order_id], |row| {
        Ok(Payment {
            id: row.get("id")?,
            order_id: row.get("order_id")?,
            method: parse_payment_method(row.get("method")?)?,
            amount: row.get("amount")?,
            tendered: row.get("tendered")?,
            change_due: row.get("change_due")?,
            paid_at: row.get("paid_at")?,
            ref_note: row.get("ref_note")?,
        })
    })?;
    rows.collect()
}

pub fn get_order(conn: &Connection, id: i64) -> rusqlite::Result<Order> {
    let mut order = conn.query_row("SELECT * FROM orders WHERE id=?1", [id], row_to_order_base)?;
    order.items = load_items(conn, id)?;
    order.discounts = load_discounts(conn, id)?;
    order.payments = load_payments(conn, id)?;
    Ok(order)
}

fn validate_item(input: &OrderItemInput) -> rusqlite::Result<()> {
    if input.product_name.trim().is_empty() || input.unit_price < 0 || input.quantity < 1 {
        return Err(rusqlite::Error::InvalidParameterName(
            "món/giá/số lượng không hợp lệ".into(),
        ));
    }
    if input.line_discount < 0 {
        return Err(rusqlite::Error::InvalidParameterName(
            "giảm giá dòng không hợp lệ".into(),
        ));
    }
    for topping in &input.toppings {
        if topping.topping_name.trim().is_empty() || topping.price < 0 || topping.quantity < 1 {
            return Err(rusqlite::Error::InvalidParameterName(
                "topping không hợp lệ".into(),
            ));
        }
    }
    Ok(())
}

fn insert_item(conn: &Connection, order_id: i64, input: OrderItemInput) -> rusqlite::Result<i64> {
    validate_item(&input)?;
    let line_total = order::compute_line_total(&input);
    conn.execute(
        "INSERT INTO order_items(
            order_id, product_id, product_name, size_name, unit_price, quantity,
            sugar_level, ice_level, line_note, line_discount, line_total
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            order_id,
            input.product_id,
            input.product_name.trim(),
            input.size_name,
            input.unit_price,
            input.quantity,
            input.sugar_level,
            input.ice_level,
            input.line_note,
            input.line_discount,
            line_total
        ],
    )?;
    let item_id = conn.last_insert_rowid();
    for topping in input.toppings {
        conn.execute(
            "INSERT INTO order_item_toppings(
                order_item_id, topping_id, topping_name, price, quantity
             ) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                item_id,
                topping.topping_id,
                topping.topping_name.trim(),
                topping.price,
                topping.quantity
            ],
        )?;
    }
    Ok(item_id)
}

pub fn recompute_order_totals(conn: &Connection, order_id: i64) -> rusqlite::Result<()> {
    let items = load_items(conn, order_id)?;
    let mut line_totals = Vec::with_capacity(items.len());
    for item in &items {
        let input = OrderItemInput {
            product_id: item.product_id,
            product_name: item.product_name.clone(),
            size_name: item.size_name.clone(),
            unit_price: item.unit_price,
            quantity: item.quantity,
            sugar_level: item.sugar_level.clone(),
            ice_level: item.ice_level.clone(),
            line_note: item.line_note.clone(),
            line_discount: item.line_discount,
            toppings: item
                .toppings
                .iter()
                .map(|topping| OrderItemToppingInput {
                    topping_id: topping.topping_id,
                    topping_name: topping.topping_name.clone(),
                    price: topping.price,
                    quantity: topping.quantity,
                })
                .collect(),
        };
        let line_total = order::compute_line_total(&input);
        conn.execute(
            "UPDATE order_items SET line_total=?2 WHERE id=?1",
            params![item.id, line_total],
        )?;
        line_totals.push(line_total);
    }

    let subtotal = order::compute_subtotal(&line_totals);
    let rounding_unit = settings::get_setting(conn, "rounding_unit")?
        .and_then(|value| value.parse::<i64>().ok())
        .unwrap_or(1);
    let discounts = load_discounts(conn, order_id)?;
    let discount_inputs: Vec<payment::DiscountResolution> = discounts
        .iter()
        .map(|discount| payment::DiscountResolution {
            discount_type: discount.r#type.clone(),
            value: discount.value,
        })
        .collect();
    let (amounts, discount_total) =
        payment::resolve_all_discounts(&discount_inputs, subtotal, rounding_unit);
    for (discount, amount) in discounts.iter().zip(amounts) {
        conn.execute(
            "UPDATE order_discounts SET amount_applied=?2 WHERE id=?1",
            params![discount.id, amount],
        )?;
    }
    let total = order::round_vnd(
        order::compute_total(subtotal, discount_total),
        rounding_unit,
    );
    conn.execute(
        "UPDATE orders SET subtotal=?2, discount_total=?3, total=?4 WHERE id=?1",
        params![order_id, subtotal, discount_total, total],
    )?;
    Ok(())
}

pub fn create_order(conn: &Connection, input: CreateOrderInput) -> rusqlite::Result<Order> {
    if matches!(input.order_type, OrderType::DineIn) && input.table_id.is_none() {
        return Err(rusqlite::Error::InvalidParameterName(
            "Đơn tại bàn cần chọn bàn".into(),
        ));
    }
    let table_id = if matches!(input.order_type, OrderType::Takeaway) {
        None
    } else {
        input.table_id
    };
    if let Some(table_id) = table_id {
        let open_count: i64 = conn.query_row(
            "SELECT count(*) FROM orders WHERE table_id=?1 AND status='OPEN'",
            [table_id],
            |row| row.get(0),
        )?;
        if open_count > 0 {
            return Err(rusqlite::Error::InvalidParameterName(
                "Bàn đang có đơn mở".into(),
            ));
        }
    }

    let created_at = now_iso(conn)?;
    let shift_id = shifts::current_open_shift_id(conn)?;
    conn.execute(
        "INSERT INTO orders(code, order_type, table_id, shift_id, status, note, created_at)
         VALUES (?1, ?2, ?3, ?4, 'OPEN', ?5, ?6)",
        params![
            next_code(),
            order_type_to_str(&input.order_type),
            table_id,
            shift_id,
            input.note,
            created_at
        ],
    )?;
    get_order(conn, conn.last_insert_rowid())
}

pub fn get_open_order_for_table(
    conn: &Connection,
    table_id: i64,
) -> rusqlite::Result<Option<Order>> {
    let id = conn
        .query_row(
            "SELECT id FROM orders WHERE table_id=?1 AND status='OPEN'",
            [table_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()?;
    id.map(|id| get_order(conn, id)).transpose()
}

pub fn add_order_item(
    conn: &Connection,
    order_id: i64,
    input: OrderItemInput,
) -> rusqlite::Result<Order> {
    conn.execute_batch("BEGIN")?;
    let result = (|| {
        insert_item(conn, order_id, input)?;
        recompute_order_totals(conn, order_id)?;
        Ok::<(), rusqlite::Error>(())
    })();
    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT")?;
            get_order(conn, order_id)
        }
        Err(error) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(error)
        }
    }
}

pub fn update_order_item(
    conn: &Connection,
    item_id: i64,
    input: OrderItemInput,
) -> rusqlite::Result<Order> {
    validate_item(&input)?;
    let order_id: i64 = conn.query_row(
        "SELECT order_id FROM order_items WHERE id=?1",
        [item_id],
        |row| row.get(0),
    )?;
    conn.execute_batch("BEGIN")?;
    let result = (|| {
        let line_total = order::compute_line_total(&input);
        conn.execute(
            "UPDATE order_items
             SET product_id=?2, product_name=?3, size_name=?4, unit_price=?5, quantity=?6,
                 sugar_level=?7, ice_level=?8, line_note=?9, line_discount=?10, line_total=?11
             WHERE id=?1",
            params![
                item_id,
                input.product_id,
                input.product_name.trim(),
                input.size_name,
                input.unit_price,
                input.quantity,
                input.sugar_level,
                input.ice_level,
                input.line_note,
                input.line_discount,
                line_total
            ],
        )?;
        conn.execute(
            "DELETE FROM order_item_toppings WHERE order_item_id=?1",
            [item_id],
        )?;
        for topping in input.toppings {
            conn.execute(
                "INSERT INTO order_item_toppings(order_item_id, topping_id, topping_name, price, quantity)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    item_id,
                    topping.topping_id,
                    topping.topping_name.trim(),
                    topping.price,
                    topping.quantity
                ],
            )?;
        }
        recompute_order_totals(conn, order_id)?;
        Ok::<(), rusqlite::Error>(())
    })();
    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT")?;
            get_order(conn, order_id)
        }
        Err(error) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(error)
        }
    }
}

pub fn remove_order_item(conn: &Connection, item_id: i64) -> rusqlite::Result<Order> {
    let order_id: i64 = conn.query_row(
        "SELECT order_id FROM order_items WHERE id=?1",
        [item_id],
        |row| row.get(0),
    )?;
    conn.execute_batch("BEGIN")?;
    let result = (|| {
        conn.execute("DELETE FROM order_items WHERE id=?1", [item_id])?;
        recompute_order_totals(conn, order_id)?;
        Ok::<(), rusqlite::Error>(())
    })();
    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT")?;
            get_order(conn, order_id)
        }
        Err(error) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(error)
        }
    }
}

pub fn cancel_order(conn: &Connection, id: i64) -> rusqlite::Result<Order> {
    conn.execute(
        "UPDATE orders SET status='CANCELLED' WHERE id=?1 AND status='OPEN'",
        [id],
    )?;
    get_order(conn, id)
}

pub fn transfer_table(
    conn: &Connection,
    order_id: i64,
    to_table_id: i64,
) -> rusqlite::Result<Order> {
    let occupied: i64 = conn.query_row(
        "SELECT count(*) FROM orders WHERE table_id=?1 AND status='OPEN' AND id<>?2",
        params![to_table_id, order_id],
        |row| row.get(0),
    )?;
    if occupied > 0 {
        return Err(rusqlite::Error::InvalidParameterName(
            "Bàn đích đang có đơn mở".into(),
        ));
    }
    conn.execute(
        "UPDATE orders SET table_id=?2, order_type='DINE_IN' WHERE id=?1 AND status='OPEN'",
        params![order_id, to_table_id],
    )?;
    get_order(conn, order_id)
}

pub fn merge_tables(
    conn: &Connection,
    source_order_ids: Vec<i64>,
    target_order_id: i64,
) -> rusqlite::Result<Order> {
    conn.execute_batch("BEGIN")?;
    let result = (|| {
        for source_id in source_order_ids {
            if source_id == target_order_id {
                continue;
            }
            conn.execute(
                "UPDATE order_items SET order_id=?2 WHERE order_id=?1",
                params![source_id, target_order_id],
            )?;
            conn.execute(
                "UPDATE orders SET status='CANCELLED', subtotal=0, discount_total=0, total=0
                 WHERE id=?1 AND status='OPEN'",
                [source_id],
            )?;
        }
        recompute_order_totals(conn, target_order_id)?;
        Ok::<(), rusqlite::Error>(())
    })();
    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT")?;
            get_order(conn, target_order_id)
        }
        Err(error) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(error)
        }
    }
}

pub fn list_open_orders(conn: &Connection) -> rusqlite::Result<Vec<Order>> {
    let mut stmt =
        conn.prepare("SELECT id FROM orders WHERE status='OPEN' ORDER BY created_at, id")?;
    let ids = stmt
        .query_map([], |row| row.get::<_, i64>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    ids.into_iter().map(|id| get_order(conn, id)).collect()
}

pub fn mark_paid(conn: &Connection, order_id: i64) -> rusqlite::Result<Order> {
    let paid_at = now_iso(conn)?;
    conn.execute(
        "UPDATE orders SET status=?2, paid_at=?3 WHERE id=?1",
        params![order_id, order_status_to_str(&OrderStatus::Paid), paid_at],
    )?;
    get_order(conn, order_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;

    fn conn() -> Connection {
        let mut c = Connection::open_in_memory().unwrap();
        c.pragma_update(None, "foreign_keys", "ON").unwrap();
        migrations::run(&mut c).unwrap();
        c
    }

    fn table_id(c: &Connection, name: &str) -> i64 {
        c.query_row("SELECT id FROM tables WHERE name=?1", [name], |row| {
            row.get(0)
        })
        .unwrap()
    }

    fn item_input() -> OrderItemInput {
        OrderItemInput {
            product_id: None,
            product_name: "Matcha Latte".into(),
            size_name: Some("M".into()),
            unit_price: 35_000,
            quantity: 2,
            sugar_level: Some("50%".into()),
            ice_level: Some("Ít".into()),
            line_note: None,
            line_discount: 5_000,
            toppings: vec![OrderItemToppingInput {
                topping_id: None,
                topping_name: "Trân châu".into(),
                price: 5_000,
                quantity: 1,
            }],
        }
    }

    #[test]
    fn create_takeaway_order() {
        let c = conn();
        let order = create_order(
            &c,
            CreateOrderInput {
                order_type: OrderType::Takeaway,
                table_id: None,
                note: None,
            },
        )
        .unwrap();
        assert_eq!(order.status, OrderStatus::Open);
        assert_eq!(order.table_id, None);
    }

    #[test]
    fn add_order_item_snapshots_and_recomputes_total() {
        let c = conn();
        let order = create_order(
            &c,
            CreateOrderInput {
                order_type: OrderType::Takeaway,
                table_id: None,
                note: None,
            },
        )
        .unwrap();
        let updated = add_order_item(&c, order.id, item_input()).unwrap();
        assert_eq!(updated.items.len(), 1);
        assert_eq!(updated.items[0].product_name, "Matcha Latte");
        assert_eq!(updated.items[0].line_total, 75_000);
        assert_eq!(updated.total, 75_000);
    }

    #[test]
    fn one_open_order_per_table() {
        let c = conn();
        let table_id = table_id(&c, "Bàn 1");
        create_order(
            &c,
            CreateOrderInput {
                order_type: OrderType::DineIn,
                table_id: Some(table_id),
                note: None,
            },
        )
        .unwrap();
        assert!(create_order(
            &c,
            CreateOrderInput {
                order_type: OrderType::DineIn,
                table_id: Some(table_id),
                note: None,
            },
        )
        .is_err());
    }

    #[test]
    fn transfer_table_rejects_occupied_destination() {
        let c = conn();
        let t1 = table_id(&c, "Bàn 1");
        let t2 = table_id(&c, "Bàn 2");
        let first = create_order(
            &c,
            CreateOrderInput {
                order_type: OrderType::DineIn,
                table_id: Some(t1),
                note: None,
            },
        )
        .unwrap();
        create_order(
            &c,
            CreateOrderInput {
                order_type: OrderType::DineIn,
                table_id: Some(t2),
                note: None,
            },
        )
        .unwrap();
        assert!(transfer_table(&c, first.id, t2).is_err());
    }

    #[test]
    fn cancel_order_releases_table() {
        let c = conn();
        let table_id = table_id(&c, "Bàn 1");
        let order = create_order(
            &c,
            CreateOrderInput {
                order_type: OrderType::DineIn,
                table_id: Some(table_id),
                note: None,
            },
        )
        .unwrap();
        cancel_order(&c, order.id).unwrap();
        assert!(create_order(
            &c,
            CreateOrderInput {
                order_type: OrderType::DineIn,
                table_id: Some(table_id),
                note: None,
            },
        )
        .is_ok());
    }
}
