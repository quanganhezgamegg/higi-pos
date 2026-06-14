use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct Area {
    pub id: i64,
    pub name: String,
    pub sort_order: i64,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct Table {
    pub id: i64,
    pub area_id: i64,
    pub name: String,
    pub seats: Option<i64>,
    pub sort_order: i64,
    pub is_active: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TableInput {
    pub area_id: i64,
    pub name: String,
    pub seats: Option<i64>,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TableState {
    Trong,
    DangPhucVu,
}

#[derive(Debug, Clone, Serialize)]
pub struct TableStatus {
    pub table: Table,
    pub status: TableState,
    pub open_order_id: Option<i64>,
}
