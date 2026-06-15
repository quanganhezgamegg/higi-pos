pub struct ReconciliationResult {
    pub expected_cash: i64,
    pub cash_diff: i64,
    pub total_sales: i64,
}

pub fn compute_reconciliation(
    opening_cash: i64,
    closing_cash_counted: i64,
    cash_payment_amounts: &[i64],
    paid_order_totals: &[i64],
) -> ReconciliationResult {
    let cash_sum: i64 = cash_payment_amounts.iter().sum();
    let expected_cash = opening_cash + cash_sum;
    let total_sales = paid_order_totals.iter().sum();
    ReconciliationResult {
        expected_cash,
        cash_diff: closing_cash_counted - expected_cash,
        total_sales,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reconciliation_no_sales() {
        let result = compute_reconciliation(500_000, 500_000, &[], &[]);
        assert_eq!(result.expected_cash, 500_000);
        assert_eq!(result.cash_diff, 0);
        assert_eq!(result.total_sales, 0);
    }

    #[test]
    fn reconciliation_mixed_payments_counts_only_cash_for_expected_cash() {
        let result = compute_reconciliation(
            100_000,
            370_000,
            &[150_000, 120_000],
            &[150_000, 200_000, 120_000],
        );
        assert_eq!(result.expected_cash, 370_000);
        assert_eq!(result.cash_diff, 0);
        assert_eq!(result.total_sales, 470_000);
    }

    #[test]
    fn reconciliation_tracks_shortage_and_surplus() {
        assert_eq!(
            compute_reconciliation(100_000, 280_000, &[200_000], &[200_000]).cash_diff,
            -20_000
        );
        assert_eq!(
            compute_reconciliation(100_000, 310_000, &[200_000], &[200_000]).cash_diff,
            10_000
        );
    }
}
