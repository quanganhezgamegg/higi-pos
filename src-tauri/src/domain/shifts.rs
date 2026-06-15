use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ShiftStatus {
    Open,
    Closed,
}

#[derive(Debug, Clone, Serialize)]
pub struct Shift {
    pub id: i64,
    pub opened_at: String,
    pub closed_at: Option<String>,
    pub opening_cash: i64,
    pub expected_cash: Option<i64>,
    pub closing_cash_counted: Option<i64>,
    pub cash_diff: Option<i64>,
    pub total_sales: Option<i64>,
    pub status: ShiftStatus,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CloseShiftInput {
    pub closing_cash_counted: i64,
    pub note: Option<String>,
}
