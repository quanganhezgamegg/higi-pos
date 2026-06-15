use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DiscountType {
    Percent,
    Amount,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DiscountScope {
    Order,
    Item,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PaymentMethod {
    Cash,
    Qr,
}

#[derive(Debug, Clone, Serialize)]
pub struct Discount {
    pub id: i64,
    pub name: String,
    pub r#type: DiscountType,
    pub value: i64,
    pub scope: DiscountScope,
    pub is_active: bool,
    pub valid_from: Option<String>,
    pub valid_to: Option<String>,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DiscountInput {
    pub name: String,
    pub r#type: DiscountType,
    pub value: i64,
    pub scope: DiscountScope,
    pub valid_from: Option<String>,
    pub valid_to: Option<String>,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct OrderDiscount {
    pub id: i64,
    pub order_id: i64,
    pub discount_id: Option<i64>,
    pub name: String,
    pub r#type: DiscountType,
    pub value: i64,
    pub amount_applied: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ApplyDiscountInput {
    pub discount_id: Option<i64>,
    pub name: String,
    pub r#type: DiscountType,
    pub value: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct Payment {
    pub id: i64,
    pub order_id: i64,
    pub method: PaymentMethod,
    pub amount: i64,
    pub tendered: Option<i64>,
    pub change_due: Option<i64>,
    pub paid_at: String,
    pub ref_note: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PaymentInput {
    pub method: PaymentMethod,
    pub amount: i64,
    pub tendered: Option<i64>,
    pub ref_note: Option<String>,
}
