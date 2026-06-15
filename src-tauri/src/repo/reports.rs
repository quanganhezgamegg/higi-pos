use rusqlite::{params, Connection};

use crate::domain::reports::*;

fn where_clause(input: &ReportRangeInput, alias: &str) -> (String, Vec<String>) {
    if let Some(shift_id) = input.shift_id {
        return (format!("{alias}.shift_id = {shift_id}"), Vec::new());
    }

    let mut clauses = vec![format!("{alias}.status='PAID'")];
    let mut params = Vec::new();
    if let Some(from) = &input.from {
        clauses.push(format!("{alias}.paid_at >= ?{}", params.len() + 1));
        params.push(from.clone());
    }
    if let Some(to) = &input.to {
        clauses.push(format!("{alias}.paid_at <= ?{}", params.len() + 1));
        params.push(to.clone());
    }
    (clauses.join(" AND "), params)
}

pub fn report_sales_summary(
    conn: &Connection,
    input: ReportRangeInput,
) -> rusqlite::Result<SalesSummary> {
    let (where_sql, values) = where_clause(&input, "o");
    let sql = format!(
        "SELECT COALESCE(sum(o.total),0), count(*), COALESCE(sum(o.discount_total),0)
         FROM orders o
         WHERE {where_sql} AND o.status='PAID'"
    );
    let mut stmt = conn.prepare(&sql)?;
    let (revenue, order_count, discount_total): (i64, i64, i64) = match values.as_slice() {
        [] => stmt.query_row([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?,
        [a] => stmt.query_row([a], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?,
        [a, b] => stmt.query_row(params![a, b], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })?,
        _ => unreachable!(),
    };
    Ok(SalesSummary {
        revenue,
        order_count,
        avg_order_value: if order_count == 0 {
            0
        } else {
            revenue / order_count
        },
        discount_total,
    })
}

pub fn report_payment_mix(
    conn: &Connection,
    input: ReportRangeInput,
) -> rusqlite::Result<Vec<PaymentMixRow>> {
    let (where_sql, values) = where_clause(&input, "o");
    let sql = format!(
        "SELECT p.method, COALESCE(sum(p.amount),0), count(*)
         FROM payments p
         JOIN orders o ON o.id = p.order_id
         WHERE {where_sql} AND o.status='PAID'
         GROUP BY p.method
         ORDER BY p.method"
    );
    let mut stmt = conn.prepare(&sql)?;
    match values.as_slice() {
        [] => stmt
            .query_map([], payment_mix_row)?
            .collect::<rusqlite::Result<Vec<_>>>(),
        [a] => stmt
            .query_map([a], payment_mix_row)?
            .collect::<rusqlite::Result<Vec<_>>>(),
        [a, b] => stmt
            .query_map(params![a, b], payment_mix_row)?
            .collect::<rusqlite::Result<Vec<_>>>(),
        _ => unreachable!(),
    }
}

fn payment_mix_row(row: &rusqlite::Row) -> rusqlite::Result<PaymentMixRow> {
    Ok(PaymentMixRow {
        method: row.get(0)?,
        total: row.get(1)?,
        count: row.get(2)?,
    })
}

pub fn report_top_products(
    conn: &Connection,
    input: ReportRangeInput,
    limit: i64,
) -> rusqlite::Result<Vec<TopProductRow>> {
    let (where_sql, values) = where_clause(&input, "o");
    let sql = format!(
        "SELECT i.product_name, COALESCE(sum(i.quantity),0), COALESCE(sum(i.line_total),0)
         FROM order_items i
         JOIN orders o ON o.id = i.order_id
         WHERE {where_sql} AND o.status='PAID'
         GROUP BY i.product_name
         ORDER BY sum(i.quantity) DESC, sum(i.line_total) DESC
         LIMIT {limit}"
    );
    let mut stmt = conn.prepare(&sql)?;
    match values.as_slice() {
        [] => stmt
            .query_map([], top_product_row)?
            .collect::<rusqlite::Result<Vec<_>>>(),
        [a] => stmt
            .query_map([a], top_product_row)?
            .collect::<rusqlite::Result<Vec<_>>>(),
        [a, b] => stmt
            .query_map(params![a, b], top_product_row)?
            .collect::<rusqlite::Result<Vec<_>>>(),
        _ => unreachable!(),
    }
}

fn top_product_row(row: &rusqlite::Row) -> rusqlite::Result<TopProductRow> {
    Ok(TopProductRow {
        product_name: row.get(0)?,
        quantity: row.get(1)?,
        revenue: row.get(2)?,
    })
}

pub fn report_discount_total(conn: &Connection, input: ReportRangeInput) -> rusqlite::Result<i64> {
    Ok(report_sales_summary(conn, input)?.discount_total)
}

pub fn report_shift_summary(conn: &Connection, shift_id: i64) -> rusqlite::Result<SalesSummary> {
    report_sales_summary(
        conn,
        ReportRangeInput {
            from: None,
            to: None,
            shift_id: Some(shift_id),
        },
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;

    fn conn() -> Connection {
        let mut c = Connection::open_in_memory().unwrap();
        c.pragma_update(None, "foreign_keys", "ON").unwrap();
        migrations::run(&mut c).unwrap();
        c.execute(
            "INSERT INTO orders(code,order_type,status,subtotal,discount_total,total,created_at,paid_at,shift_id)
             VALUES ('R-1','TAKEAWAY','PAID',100000,10000,90000,'2026-01-01T08:00:00Z','2026-01-01T09:00:00Z',1)",
            [],
        )
        .unwrap();
        let order_id = c.last_insert_rowid();
        c.execute(
            "INSERT INTO order_items(order_id,product_name,unit_price,quantity,line_total)
             VALUES (?1,'Matcha Latte',45000,2,90000)",
            [order_id],
        )
        .unwrap();
        c.execute(
            "INSERT INTO payments(order_id,method,amount,paid_at) VALUES (?1,'QR',90000,'2026-01-01T09:00:00Z')",
            [order_id],
        )
        .unwrap();
        c
    }

    #[test]
    fn sales_summary_counts_paid_orders() {
        let c = conn();
        let summary = report_sales_summary(
            &c,
            ReportRangeInput {
                from: None,
                to: None,
                shift_id: None,
            },
        )
        .unwrap();
        assert_eq!(summary.revenue, 90_000);
        assert_eq!(summary.order_count, 1);
        assert_eq!(summary.discount_total, 10_000);
    }

    #[test]
    fn payment_mix_and_top_products() {
        let c = conn();
        let input = ReportRangeInput {
            from: None,
            to: None,
            shift_id: None,
        };
        assert_eq!(
            report_payment_mix(&c, input.clone()).unwrap()[0].method,
            "QR"
        );
        assert_eq!(
            report_top_products(&c, input, 5).unwrap()[0].product_name,
            "Matcha Latte"
        );
    }
}
