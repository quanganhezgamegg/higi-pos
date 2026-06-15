use crate::domain::payments::DiscountType;
use crate::services::order::round_vnd;

pub struct DiscountResolution {
    pub discount_type: DiscountType,
    pub value: i64,
}

pub fn resolve_discount_amount(
    discount: &DiscountResolution,
    subtotal: i64,
    already_applied: i64,
    rounding_unit: i64,
) -> i64 {
    let raw = match discount.discount_type {
        DiscountType::Percent => round_vnd(subtotal * discount.value / 100, rounding_unit),
        DiscountType::Amount => discount.value,
    }
    .max(0);
    let remaining = (subtotal - already_applied).max(0);
    raw.min(remaining)
}

pub fn resolve_all_discounts(
    discounts: &[DiscountResolution],
    subtotal: i64,
    rounding_unit: i64,
) -> (Vec<i64>, i64) {
    let mut applied = Vec::with_capacity(discounts.len());
    let mut total = 0;
    for discount in discounts {
        let amount = resolve_discount_amount(discount, subtotal, total, rounding_unit);
        total += amount;
        applied.push(amount);
    }
    (applied, total)
}

pub fn compute_change_due(tendered: i64, amount_due: i64) -> Result<i64, String> {
    if tendered < amount_due {
        return Err("Tiền khách đưa chưa đủ".into());
    }
    Ok((tendered - amount_due).max(0))
}

pub fn validate_finalize(payments_total: i64, order_total: i64) -> Result<(), String> {
    if payments_total < order_total {
        return Err("Tổng thanh toán chưa đủ tổng đơn".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn percent(value: i64) -> DiscountResolution {
        DiscountResolution {
            discount_type: DiscountType::Percent,
            value,
        }
    }

    fn amount(value: i64) -> DiscountResolution {
        DiscountResolution {
            discount_type: DiscountType::Amount,
            value,
        }
    }

    #[test]
    fn percent_discount_uses_subtotal() {
        assert_eq!(resolve_discount_amount(&percent(10), 100_000, 0, 1), 10_000);
    }

    #[test]
    fn amount_discount_clamps_to_remaining_subtotal() {
        assert_eq!(
            resolve_discount_amount(&amount(30_000), 50_000, 40_000, 1),
            10_000
        );
    }

    #[test]
    fn cumulative_discounts_never_exceed_subtotal() {
        let (amounts, total) = resolve_all_discounts(&[amount(20_000), amount(20_000)], 30_000, 1);
        assert_eq!(amounts, vec![20_000, 10_000]);
        assert_eq!(total, 30_000);
    }

    #[test]
    fn cash_change_requires_enough_tendered() {
        assert_eq!(compute_change_due(100_000, 85_000).unwrap(), 15_000);
        assert!(compute_change_due(50_000, 85_000).is_err());
    }

    #[test]
    fn finalize_requires_paid_total() {
        assert!(validate_finalize(90_000, 100_000).is_err());
        assert!(validate_finalize(100_000, 100_000).is_ok());
    }
}
