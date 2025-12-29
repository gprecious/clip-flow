use crate::error::Result;
use crate::services::{DownloadService, ModelStatus, WhisperModel};
use tauri::{AppHandle, Emitter};

/// Get list of available Whisper models
#[tauri::command]
pub async fn get_available_models() -> Result<Vec<WhisperModel>> {
    Ok(WhisperModel::available_models())
}

/// Get list of installed models
#[tauri::command]
pub async fn get_installed_models() -> Result<Vec<String>> {
    let service = DownloadService::new()?;
    service.get_installed_models().await
}

/// Get status of all models (available + installed info)
#[tauri::command]
pub async fn get_models_status() -> Result<Vec<ModelStatus>> {
    let service = DownloadService::new()?;
    let installed = service.get_installed_models().await?;

    let statuses: Vec<ModelStatus> = WhisperModel::available_models()
        .into_iter()
        .map(|model| {
            let is_installed = installed.contains(&model.id);
            let path = if is_installed {
                Some(service.get_model_path(&model.id).to_string_lossy().to_string())
            } else {
                None
            };

            ModelStatus {
                id: model.id,
                name: model.name,
                description: model.description,
                size_display: model.size_display,
                installed: is_installed,
                path,
            }
        })
        .collect();

    Ok(statuses)
}

/// Check if a specific model is installed
#[tauri::command]
pub async fn is_model_installed(model_id: String) -> Result<bool> {
    let service = DownloadService::new()?;
    service.is_model_installed(&model_id).await
}

/// Download a Whisper model
#[tauri::command]
pub async fn download_model(app: AppHandle, model_id: String) -> Result<String> {
    let service = DownloadService::new()?;

    let app_handle = app.clone();
    let result = service.download_model(&model_id, move |progress| {
        let _ = app_handle.emit("model:download-progress", progress);
    }).await?;

    Ok(result.to_string_lossy().to_string())
}

/// Delete a downloaded model
#[tauri::command]
pub async fn delete_model(model_id: String) -> Result<()> {
    let service = DownloadService::new()?;
    service.delete_model(&model_id).await
}

/// Get models directory path
#[tauri::command]
pub async fn get_models_directory() -> Result<String> {
    let path = DownloadService::get_models_directory()?;
    Ok(path.to_string_lossy().to_string())
}
