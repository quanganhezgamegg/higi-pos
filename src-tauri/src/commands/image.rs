use base64::Engine;
use std::path::{Component, Path, PathBuf};
use tauri::Manager;

fn images_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("images");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn image_extension(path: &Path) -> Result<String, String> {
    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_lowercase())
        .ok_or_else(|| "File ảnh không có đuôi hợp lệ".to_string())?;

    match extension.as_str() {
        "png" | "jpg" | "jpeg" | "webp" => Ok(extension),
        _ => Err("Chỉ hỗ trợ ảnh png, jpg, jpeg, webp".to_string()),
    }
}

fn mime_for_extension(extension: &str) -> &'static str {
    match extension.to_lowercase().as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        _ => "image/png",
    }
}

fn safe_relative_image_path(relative_path: &str) -> Result<PathBuf, String> {
    let normalized = relative_path.replace('\\', "/");
    let path = Path::new(&normalized);

    if path.is_absolute() {
        return Err("Đường dẫn ảnh không hợp lệ".to_string());
    }

    let mut components = path.components();
    match components.next() {
        Some(Component::Normal(prefix)) if prefix == "images" => {}
        _ => return Err("Đường dẫn ảnh phải nằm trong thư mục images".to_string()),
    }

    if path
        .components()
        .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err("Đường dẫn ảnh không hợp lệ".to_string());
    }

    Ok(path.to_path_buf())
}

#[tauri::command]
pub fn save_product_image(app: tauri::AppHandle, source_path: String) -> Result<String, String> {
    let source = Path::new(&source_path);
    let extension = image_extension(source)?;
    let bytes = std::fs::read(source).map_err(|e| e.to_string())?;
    let name = format!("{}.{}", uuid::Uuid::new_v4(), extension);
    let destination = images_dir(&app)?.join(&name);

    std::fs::write(destination, bytes).map_err(|e| e.to_string())?;
    Ok(format!("images/{name}"))
}

#[tauri::command]
pub fn read_image_data_url(app: tauri::AppHandle, relative_path: String) -> Result<String, String> {
    let relative = safe_relative_image_path(&relative_path)?;
    let extension = image_extension(&relative)?;
    let full = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(relative);
    let bytes = std::fs::read(&full).map_err(|e| e.to_string())?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(format!(
        "data:{};base64,{encoded}",
        mime_for_extension(&extension)
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mime_for_supported_extensions() {
        assert_eq!(mime_for_extension("jpg"), "image/jpeg");
        assert_eq!(mime_for_extension("jpeg"), "image/jpeg");
        assert_eq!(mime_for_extension("webp"), "image/webp");
        assert_eq!(mime_for_extension("png"), "image/png");
    }

    #[test]
    fn safe_relative_image_path_rejects_outside_images_dir() {
        assert!(safe_relative_image_path("../higipos.db").is_err());
        assert!(safe_relative_image_path("..\\higipos.db").is_err());
        assert!(safe_relative_image_path("other/foo.png").is_err());
        assert!(safe_relative_image_path("images/foo.png").is_ok());
    }
}
