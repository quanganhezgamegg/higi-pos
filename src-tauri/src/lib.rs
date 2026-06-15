mod commands;
mod db;
mod domain;
mod repo;
mod services;

use std::sync::Mutex;
use tauri::Manager;

use crate::db::AppDb;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let db_path = dir.join("higipos.db");
            let conn = db::open_and_migrate(&db_path)?;
            app.manage(AppDb(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::get_settings_bulk,
            commands::settings::set_settings_bulk,
            commands::settings::list_sugar_levels,
            commands::settings::list_ice_levels,
            commands::settings::update_sugar_ice_levels,
            commands::settings::app_version,
            commands::menu::list_categories,
            commands::menu::create_category,
            commands::menu::update_category,
            commands::menu::delete_category,
            commands::menu::list_products,
            commands::menu::create_product,
            commands::menu::update_product,
            commands::menu::set_product_active,
            commands::menu::delete_product,
            commands::menu::list_toppings,
            commands::menu::create_topping,
            commands::menu::update_topping,
            commands::menu::delete_topping,
            commands::tables::list_areas,
            commands::tables::create_area,
            commands::tables::update_area,
            commands::tables::delete_area,
            commands::tables::list_tables,
            commands::tables::create_table,
            commands::tables::update_table,
            commands::tables::set_table_active,
            commands::tables::delete_table,
            commands::tables::list_table_status,
            commands::orders::create_order,
            commands::orders::get_open_order_for_table,
            commands::orders::get_order,
            commands::orders::add_order_item,
            commands::orders::update_order_item,
            commands::orders::remove_order_item,
            commands::orders::cancel_order,
            commands::orders::transfer_table,
            commands::orders::merge_tables,
            commands::orders::list_open_orders,
            commands::payments::list_discounts,
            commands::payments::create_discount,
            commands::payments::update_discount,
            commands::payments::set_discount_active,
            commands::payments::apply_discount,
            commands::payments::remove_order_discount,
            commands::payments::add_payment,
            commands::payments::finalize_order,
            commands::payments::generate_bill_html,
            commands::payments::generate_bill_pdf,
            commands::shifts::get_current_shift,
            commands::shifts::open_shift,
            commands::shifts::close_shift,
            commands::reports::report_sales_summary,
            commands::reports::report_payment_mix,
            commands::reports::report_top_products,
            commands::reports::report_discount_total,
            commands::reports::report_shift_summary,
            commands::backup::backup_database,
            commands::image::save_product_image,
            commands::image::read_image_data_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
