use qrcode::render::svg;
use qrcode::{EcLevel, QrCode};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct Bank {
    pub bin: String,
    pub name: String,
    pub short_name: String,
}

pub fn list_banks() -> Vec<Bank> {
    vec![
        Bank {
            bin: "970436".into(),
            name: "Vietcombank".into(),
            short_name: "Vietcombank".into(),
        },
        Bank {
            bin: "970415".into(),
            name: "VietinBank".into(),
            short_name: "VietinBank".into(),
        },
        Bank {
            bin: "970418".into(),
            name: "BIDV".into(),
            short_name: "BIDV".into(),
        },
        Bank {
            bin: "970405".into(),
            name: "Agribank".into(),
            short_name: "Agribank".into(),
        },
        Bank {
            bin: "970422".into(),
            name: "MB Bank".into(),
            short_name: "MB Bank".into(),
        },
        Bank {
            bin: "970432".into(),
            name: "VPBank".into(),
            short_name: "VPBank".into(),
        },
        Bank {
            bin: "970423".into(),
            name: "TPBank".into(),
            short_name: "TPBank".into(),
        },
        Bank {
            bin: "970407".into(),
            name: "Techcombank".into(),
            short_name: "Techcombank".into(),
        },
        Bank {
            bin: "970416".into(),
            name: "ACB".into(),
            short_name: "ACB".into(),
        },
        Bank {
            bin: "970443".into(),
            name: "Sacombank".into(),
            short_name: "Sacombank".into(),
        },
        Bank {
            bin: "970441".into(),
            name: "VIB".into(),
            short_name: "VIB".into(),
        },
        Bank {
            bin: "970430".into(),
            name: "HDBank".into(),
            short_name: "HDBank".into(),
        },
        Bank {
            bin: "970448".into(),
            name: "LPBank".into(),
            short_name: "LPBank".into(),
        },
        Bank {
            bin: "422589".into(),
            name: "SeABank".into(),
            short_name: "SeABank".into(),
        },
        Bank {
            bin: "970403".into(),
            name: "DongA Bank".into(),
            short_name: "DongA Bank".into(),
        },
    ]
}

pub fn bank_name_by_bin(bin: &str) -> String {
    list_banks()
        .into_iter()
        .find(|bank| bank.bin == bin)
        .map(|bank| bank.short_name)
        .unwrap_or_else(|| bin.to_string())
}

pub fn tlv(id: &str, value: &str) -> String {
    format!("{}{:02}{}", id, value.len(), value)
}

pub fn crc16_ccitt(data: &[u8]) -> u16 {
    let mut crc = 0xFFFFu16;
    for byte in data {
        crc ^= (*byte as u16) << 8;
        for _ in 0..8 {
            if crc & 0x8000 != 0 {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    crc
}

pub fn build_vietqr_payload(
    bank_bin: &str,
    account_number: &str,
    amount: i64,
    content: &str,
) -> String {
    let bank_info = format!("{}{}", tlv("00", bank_bin), tlv("01", account_number));
    let napas_account = format!(
        "{}{}{}",
        tlv("00", "A000000727"),
        tlv("01", &bank_info),
        tlv("02", "QRIBFTTA"),
    );
    let additional_data = tlv("08", content);
    let amount_field = if amount > 0 {
        tlv("54", &amount.to_string())
    } else {
        String::new()
    };

    let body = format!(
        "{}{}{}{}{}{}{}",
        tlv("00", "01"),
        tlv("01", "12"),
        tlv("38", &napas_account),
        tlv("53", "704"),
        amount_field,
        tlv("58", "VN"),
        tlv("62", &additional_data),
    );
    let crc_input = format!("{body}6304");
    let crc = crc16_ccitt(crc_input.as_bytes());

    format!("{body}6304{crc:04X}")
}

pub fn build_qr_svg(payload: &str) -> String {
    let code = QrCode::with_error_correction_level(payload.as_bytes(), EcLevel::M)
        .expect("QR code generation failed");
    code.render::<svg::Color>().min_dimensions(200, 200).build()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crc16_known_value() {
        let result = crc16_ccitt(b"123456789");
        assert_eq!(result, 0x29B1);
    }

    #[test]
    fn crc16_empty_string() {
        let result = crc16_ccitt(b"");
        assert_eq!(result, 0xFFFF);
    }

    #[test]
    fn tlv_builds_id_len_value() {
        let result = tlv("00", "01");
        assert_eq!(result, "000201");
    }

    #[test]
    fn tlv_pads_len_to_two_digits() {
        let result = tlv("58", "VN");
        assert_eq!(result, "5802VN");
    }

    #[test]
    fn tlv_len_of_long_value() {
        let result = tlv("00", "A000000727");
        assert_eq!(&result[2..4], "10");
    }

    #[test]
    fn payload_contains_required_fields() {
        let payload = build_vietqr_payload("970436", "1234567890", 50_000, "DH000001");

        assert!(payload.contains("000201"));
        assert!(payload.contains("010211") || payload.contains("010212"));
        assert!(payload.starts_with("00020101"));
        assert!(payload.contains("38"));
        assert!(payload.contains("970436"));
        assert!(payload.contains("1234567890"));
        assert!(payload.contains("QRIBFTTA"));
        assert!(payload.contains("5303704"));
        assert!(payload.contains("54"));
        assert!(payload.contains("50000"));
        assert!(payload.contains("5802VN"));
        assert!(payload.contains("DH000001"));

        let crc_pos = payload.rfind("6304").expect("missing CRC tag");
        let crc_val = &payload[crc_pos + 4..];
        assert_eq!(crc_val.len(), 4);
        assert!(
            crc_val
                .chars()
                .all(|c| c.is_ascii_hexdigit() && (c.is_ascii_uppercase() || c.is_ascii_digit())),
            "CRC value must be uppercase hex: {crc_val}",
        );
    }

    #[test]
    fn payload_crc_is_self_consistent() {
        let payload = build_vietqr_payload("970436", "1234567890", 50_000, "DH000001");
        let crc_pos = payload.rfind("6304").expect("missing CRC tag");
        let msg = &payload[..crc_pos + 4];
        let crc_val = &payload[crc_pos + 4..];
        let expected = format!("{:04X}", crc16_ccitt(msg.as_bytes()));

        assert_eq!(crc_val, expected);
    }

    #[test]
    fn build_qr_svg_returns_valid_svg() {
        let payload = build_vietqr_payload("970436", "1234567890", 50_000, "DH000001");
        let svg = build_qr_svg(&payload);

        assert!(svg.starts_with("<svg") || svg.contains("<svg"));
        assert!(svg.contains("</svg>"));
    }
}
