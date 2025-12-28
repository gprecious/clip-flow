use crate::error::Result;
use crate::services::{FFmpegService, MediaInfo};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

/// Check if FFmpeg is available
#[tauri::command]
pub async fn check_ffmpeg() -> Result<bool> {
    FFmpegService::check_availability().await
}

/// Get FFmpeg version
#[tauri::command]
pub async fn get_ffmpeg_version() -> Result<String> {
    FFmpegService::get_version().await
}

/// Get media file information
#[tauri::command]
pub async fn get_media_info(path: String) -> Result<MediaInfo> {
    let path = PathBuf::from(path);
    FFmpegService::get_media_info(&path).await
}

/// Extract audio from media file
#[tauri::command]
pub async fn extract_audio(
    app: AppHandle,
    input_path: String,
    output_path: Option<String>,
) -> Result<String> {
    let input = PathBuf::from(&input_path);

    // Generate output path if not provided
    let output = match output_path {
        Some(p) => PathBuf::from(p),
        None => {
            let temp_dir = std::env::temp_dir().join("clip-flow");
            tokio::fs::create_dir_all(&temp_dir).await?;
            let filename = input.file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
            temp_dir.join(format!("{}.wav", filename))
        }
    };

    let app_handle = app.clone();
    let result = FFmpegService::extract_audio(&input, &output, move |progress| {
        let _ = app_handle.emit("ffmpeg:progress", progress);
    }).await?;

    Ok(result.to_string_lossy().to_string())
}

/// Get media duration in seconds
#[tauri::command]
pub async fn get_media_duration(path: String) -> Result<f64> {
    let path = PathBuf::from(path);
    FFmpegService::get_duration(&path).await
}
