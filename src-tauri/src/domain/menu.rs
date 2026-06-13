use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub sort_order: i64,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct Topping {
    pub id: i64,
    pub name: String,
    pub price: i64,
    pub is_active: bool,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProductSize {
    pub id: i64,
    pub name: String,
    pub price_delta: i64,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProductWithSizes {
    pub id: i64,
    pub category_id: i64,
    pub name: String,
    pub base_price: i64,
    pub description: Option<String>,
    pub image_path: Option<String>,
    pub is_active: bool,
    pub sort_order: i64,
    pub sizes: Vec<ProductSize>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SizeInput {
    pub name: String,
    pub price_delta: i64,
    pub is_default: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProductInput {
    pub name: String,
    pub category_id: i64,
    pub base_price: i64,
    pub description: Option<String>,
    pub image_path: Option<String>,
    pub sort_order: i64,
    pub sizes: Vec<SizeInput>,
}
