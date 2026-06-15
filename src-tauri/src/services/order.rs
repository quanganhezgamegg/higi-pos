use crate::domain::orders::OrderItemInput;

pub fn compute_line_total(item: &OrderItemInput) -> i64 {
    let toppings_cost: i64 = item
        .toppings
        .iter()
        .map(|topping| topping.price * topping.quantity)
        .sum();
    ((item.unit_price + toppings_cost) * item.quantity - item.line_discount).max(0)
}

pub fn compute_subtotal(line_totals: &[i64]) -> i64 {
    line_totals.iter().sum()
}

pub fn compute_total(subtotal: i64, discount_total: i64) -> i64 {
    (subtotal - discount_total).max(0)
}

pub fn round_vnd(amount: i64, rounding_unit: i64) -> i64 {
    if rounding_unit <= 1 {
        return amount;
    }
    (amount / rounding_unit) * rounding_unit
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::orders::{OrderItemInput, OrderItemToppingInput};

    fn item(
        unit_price: i64,
        quantity: i64,
        toppings: Vec<(i64, i64)>,
        line_discount: i64,
    ) -> OrderItemInput {
        OrderItemInput {
            product_id: None,
            product_name: "Test".into(),
            size_name: None,
            unit_price,
            quantity,
            sugar_level: None,
            ice_level: None,
            line_note: None,
            line_discount,
            toppings: toppings
                .into_iter()
                .map(|(price, quantity)| OrderItemToppingInput {
                    topping_id: None,
                    topping_name: "Topping".into(),
                    price,
                    quantity,
                })
                .collect(),
        }
    }

    #[test]
    fn line_total_includes_toppings_quantity_and_discount() {
        let input = item(25_000, 2, vec![(5_000, 1), (3_000, 2)], 4_000);
        assert_eq!(compute_line_total(&input), 68_000);
    }

    #[test]
    fn line_total_clamps_to_zero() {
        assert_eq!(compute_line_total(&item(10_000, 1, vec![], 50_000)), 0);
    }

    #[test]
    fn subtotal_sums_line_totals() {
        assert_eq!(compute_subtotal(&[38_000, 60_000, 0]), 98_000);
    }

    #[test]
    fn total_subtracts_discount_and_clamps() {
        assert_eq!(compute_total(100_000, 15_000), 85_000);
        assert_eq!(compute_total(10_000, 50_000), 0);
    }

    #[test]
    fn round_vnd_floors_to_unit() {
        assert_eq!(round_vnd(34_700, 500), 34_500);
        assert_eq!(round_vnd(34_700, 1), 34_700);
    }
}
