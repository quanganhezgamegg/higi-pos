use serde::{Deserialize, Serialize};

use crate::domain::orders::OrderType;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CustomerPhase {
    Idle,
    Order,
    Payment,
    ThankYou,
}

impl Default for CustomerPhase {
    fn default() -> Self {
        Self::Idle
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CustomerItemToppingView {
    pub name: String,
    pub price: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CustomerOrderItemView {
    pub name: String,
    pub size: Option<String>,
    pub sugar: Option<String>,
    pub ice: Option<String>,
    pub qty: i64,
    pub line_total: i64,
    pub toppings: Vec<CustomerItemToppingView>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CustomerOrderView {
    pub code: String,
    pub r#type: OrderType,
    pub table_name: Option<String>,
    pub items: Vec<CustomerOrderItemView>,
    pub subtotal: i64,
    pub discount_total: i64,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CustomerPaymentView {
    pub qr_svg: String,
    pub amount: i64,
    pub content: String,
    pub bank_name: String,
    pub account_number: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CustomerView {
    pub phase: CustomerPhase,
    pub order: Option<CustomerOrderView>,
    pub payment: Option<CustomerPaymentView>,
}

impl Default for CustomerView {
    fn default() -> Self {
        Self {
            phase: CustomerPhase::Idle,
            order: None,
            payment: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PaymentQr {
    pub qr_svg: String,
    pub amount: i64,
    pub content: String,
    pub bank_name: String,
    pub account_number: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Bank {
    pub bin: String,
    pub name: String,
    pub short_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Branding {
    pub shop_name: String,
    pub shop_address: String,
    pub shop_phone: String,
    pub brand_color: String,
    pub logo_path: Option<String>,
    pub idle_bg_path: Option<String>,
    pub promo_images: Vec<String>,
    pub customer_welcome_text: String,
    pub bill_footer: String,
}

impl Default for Branding {
    fn default() -> Self {
        Self {
            shop_name: "HiGi Coffee".into(),
            shop_address: String::new(),
            shop_phone: String::new(),
            brand_color: "#6F4E37".into(),
            logo_path: None,
            idle_bg_path: None,
            promo_images: Vec::new(),
            customer_welcome_text: "Chao mung quy khach".into(),
            bill_footer: "Cam on quy khach!".into(),
        }
    }
}
