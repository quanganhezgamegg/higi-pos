use rusqlite::{params, Connection, OptionalExtension};

use crate::domain::shifts::*;
use crate::services::shift;

fn now_iso(conn: &Connection) -> rusqlite::Result<String> {
    conn.query_row("SELECT strftime('%Y-%m-%dT%H:%M:%SZ','now')", [], |row| {
        row.get(0)
    })
}

fn parse_shift_status(value: String) -> rusqlite::Result<ShiftStatus> {
    match value.as_str() {
        "OPEN" => Ok(ShiftStatus::Open),
        "CLOSED" => Ok(ShiftStatus::Closed),
        _ => Err(rusqlite::Error::InvalidParameterName(format!(
            "shift status không hợp lệ: {value}"
        ))),
    }
}

fn row_to_shift(row: &rusqlite::Row) -> rusqlite::Result<Shift> {
    Ok(Shift {
        id: row.get("id")?,
        opened_at: row.get("opened_at")?,
        closed_at: row.get("closed_at")?,
        opening_cash: row.get("opening_cash")?,
        expected_cash: row.get("expected_cash")?,
        closing_cash_counted: row.get("closing_cash_counted")?,
        cash_diff: row.get("cash_diff")?,
        total_sales: row.get("total_sales")?,
        status: parse_shift_status(row.get("status")?)?,
        note: row.get("note")?,
    })
}

fn load_shift(conn: &Connection, id: i64) -> rusqlite::Result<Shift> {
    conn.query_row("SELECT * FROM shifts WHERE id=?1", [id], row_to_shift)
}

pub fn get_current_shift(conn: &Connection) -> rusqlite::Result<Option<Shift>> {
    conn.query_row(
        "SELECT * FROM shifts WHERE status='OPEN' ORDER BY id DESC LIMIT 1",
        [],
        row_to_shift,
    )
    .optional()
}

pub fn current_open_shift_id(conn: &Connection) -> rusqlite::Result<Option<i64>> {
    conn.query_row(
        "SELECT id FROM shifts WHERE status='OPEN' ORDER BY id DESC LIMIT 1",
        [],
        |row| row.get(0),
    )
    .optional()
}

pub fn open_shift(
    conn: &Connection,
    opening_cash: i64,
    note: Option<String>,
) -> rusqlite::Result<Shift> {
    if opening_cash < 0 {
        return Err(rusqlite::Error::InvalidParameterName(
            "Tiền đầu ca không hợp lệ".into(),
        ));
    }
    conn.execute(
        "INSERT INTO shifts(opened_at, opening_cash, status, note) VALUES (?1, ?2, 'OPEN', ?3)",
        params![now_iso(conn)?, opening_cash, note],
    )?;
    load_shift(conn, conn.last_insert_rowid())
}

pub fn close_shift(
    conn: &Connection,
    shift_id: i64,
    input: CloseShiftInput,
) -> rusqlite::Result<Shift> {
    if input.closing_cash_counted < 0 {
        return Err(rusqlite::Error::InvalidParameterName(
            "Tiền thực đếm không hợp lệ".into(),
        ));
    }
    let current = load_shift(conn, shift_id)?;
    if current.status != ShiftStatus::Open {
        return Err(rusqlite::Error::InvalidParameterName(
            "Ca đã đóng hoặc không còn mở".into(),
        ));
    }

    let cash_payments = collect_i64(
        conn,
        "SELECT p.amount
         FROM payments p
         JOIN orders o ON o.id = p.order_id
         WHERE p.method='CASH' AND o.status='PAID' AND o.shift_id=?1",
        shift_id,
    )?;
    let paid_order_totals = collect_i64(
        conn,
        "SELECT total FROM orders WHERE status='PAID' AND shift_id=?1",
        shift_id,
    )?;
    let result = shift::compute_reconciliation(
        current.opening_cash,
        input.closing_cash_counted,
        &cash_payments,
        &paid_order_totals,
    );
    conn.execute(
        "UPDATE shifts
         SET closed_at=?2, closing_cash_counted=?3, expected_cash=?4, cash_diff=?5,
             total_sales=?6, status='CLOSED', note=?7
         WHERE id=?1",
        params![
            shift_id,
            now_iso(conn)?,
            input.closing_cash_counted,
            result.expected_cash,
            result.cash_diff,
            result.total_sales,
            input.note
        ],
    )?;
    load_shift(conn, shift_id)
}

fn collect_i64(conn: &Connection, sql: &str, id: i64) -> rusqlite::Result<Vec<i64>> {
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([id], |row| row.get::<_, i64>(0))?;
    rows.collect()
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

    #[test]
    fn open_shift_creates_open_shift() {
        let c = conn();
        let shift = open_shift(&c, 500_000, None).unwrap();
        assert_eq!(shift.status, ShiftStatus::Open);
        assert_eq!(shift.opening_cash, 500_000);
        assert!(shift.closed_at.is_none());
    }

    #[test]
    fn cannot_open_two_shifts() {
        let c = conn();
        open_shift(&c, 100_000, None).unwrap();
        assert!(open_shift(&c, 200_000, None).is_err());
    }

    #[test]
    fn current_open_shift_id_helper() {
        let c = conn();
        assert_eq!(current_open_shift_id(&c).unwrap(), None);
        let shift = open_shift(&c, 100_000, None).unwrap();
        assert_eq!(current_open_shift_id(&c).unwrap(), Some(shift.id));
    }

    #[test]
    fn close_shift_computes_reconciliation() {
        let c = conn();
        let shift = open_shift(&c, 200_000, None).unwrap();
        c.execute(
            "INSERT INTO orders(code,order_type,shift_id,status,subtotal,total,created_at,paid_at)
             VALUES ('T-1','TAKEAWAY',?1,'PAID',150000,150000,'2026-01-01T08:00:00Z','2026-01-01T08:10:00Z')",
            [shift.id],
        )
        .unwrap();
        let order_id = c.last_insert_rowid();
        c.execute(
            "INSERT INTO payments(order_id,method,amount,paid_at) VALUES (?1,'CASH',150000,'2026-01-01T08:10:00Z')",
            [order_id],
        )
        .unwrap();
        let closed = close_shift(
            &c,
            shift.id,
            CloseShiftInput {
                closing_cash_counted: 350_000,
                note: None,
            },
        )
        .unwrap();
        assert_eq!(closed.expected_cash, Some(350_000));
        assert_eq!(closed.cash_diff, Some(0));
        assert_eq!(closed.total_sales, Some(150_000));
        assert_eq!(closed.status, ShiftStatus::Closed);
    }
}
