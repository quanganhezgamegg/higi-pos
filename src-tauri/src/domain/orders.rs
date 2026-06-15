use serde::{Deserialize, Serialize};

use crate::domain::payments::{OrderDiscount, Payment};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OrderType {
    DineIn,
    Takeaway,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OrderStatus {
    Open,
    Paid,
    Cancelled,
}

#[derive(Debug, Clone, Serialize)]
pub struct OrderItemTopping {
    pub id: i64,
    pub order_item_id: i64,
    pub topping_id: Option<i64>,
    pub topping_name: String,
    pub price: i64,
    pub quantity: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct OrderItem {
    pub id: i64,
    pub order_id: i64,
    pub product_id: Option<i64>,
    pub product_name: String,
    pub size_name: Option<String>,
    pub unit_price: i64,
    pub quantity: i64,
    pub sugar_level: Option<String>,
    pub ice_level: Option<String>,
    pub line_note: Option<String>,
    pub line_discount: i64,
    pub line_total: i64,
    pub toppings: Vec<OrderItemTopping>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Order {
    pub id: i64,
    pub code: String,
    pub order_type: OrderType,
    pub table_id: Option<i64>,
    pub shift_id: Option<i64>,
    pub status: OrderStatus,
    pub subtotal: i64,
    pub discount_total: i64,
    pub total: i64,
    pub note: Option<String>,
    pub created_at: String,
    pub paid_at: Option<String>,
    pub items: Vec<OrderItem>,
    pub discounts: Vec<OrderDiscount>,
    pub payments: Vec<Payment>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateOrderInput {
    pub order_type: OrderType,
    pub table_id: Option<i64>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OrderItemToppingInput {
    pub topping_id: Option<i64>,
    pub topping_name: String,
    pub price: i64,
    pub quantity: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OrderItemInput {
    pub product_id: Option<i64>,
    pub product_name: String,
    pub size_name: Option<String>,
    pub unit_price: i64,
    pub quantity: i64,
    pub sugar_level: Option<String>,
    pub ice_level: Option<String>,
    pub line_note: Option<String>,
    pub line_discount: i64,
    pub toppings: Vec<OrderItemToppingInput>,
}
