use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
pub struct ReportRangeInput {
    pub from: Option<String>,
    pub to: Option<String>,
    pub shift_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SalesSummary {
    pub revenue: i64,
    pub order_count: i64,
    pub avg_order_value: i64,
    pub discount_total: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PaymentMixRow {
    pub method: String,
    pub total: i64,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TopProductRow {
    pub product_name: String,
    pub quantity: i64,
    pub revenue: i64,
}
