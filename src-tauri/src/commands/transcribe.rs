use crate::error::Result;
use crate::services::{FFmpegService, TranscriptionResult, WhisperService};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

/// Transcription progress event payload
#[derive(Clone, serde::Serialize)]
pub struct TranscriptionProgress {
    pub stage: String,
    pub progress: f32,
    pub message: String,
}

/// Transcribe a media file
#[tauri::command]
pub async fn transcribe_media(
    app: AppHandle,
    file_path: String,
    model_id: String,
    language: Option<String>,
) -> Result<TranscriptionResult> {
    let input_path = PathBuf::from(&file_path);

    // Check if the media file has an audio stream
    let media_info = FFmpegService::get_media_info(&input_path).await?;
    if !media_info.has_audio {
        return Err(crate::error::AppError::FFmpeg(
            "This video does not contain an audio stream".to_string(),
        ));
    }

    // Stage 1: Extract audio
    emit_progress(&app, "extracting", 0.0, "Extracting audio...");

    let temp_dir = std::env::temp_dir().join("clip-flow");
    tokio::fs::create_dir_all(&temp_dir).await?;

    let audio_filename = format!("{}.wav", uuid::Uuid::new_v4());
    let audio_path = temp_dir.join(&audio_filename);

    let app_handle = app.clone();
    FFmpegService::extract_audio(&input_path, &audio_path, move |progress| {
        emit_progress(&app_handle, "extracting", progress * 0.3, "Extracting audio...");
    }).await?;

    emit_progress(&app, "extracting", 30.0, "Audio extraction complete");

    // Stage 2: Transcribe with Whisper
    emit_progress(&app, "transcribing", 30.0, "Starting transcription...");

    let whisper_service = WhisperService::new()?;

    let app_handle = app.clone();
    let model_name = model_id.clone();
    let result = whisper_service.transcribe(
        &audio_path,
        &model_id,
        language.as_deref(),
        move |progress| {
            let overall_progress = 30.0 + (progress * 0.7);
            emit_progress(
                &app_handle,
                "transcribing",
                overall_progress,
                &format!("Transcribing with {}...", model_name),
            );
        },
    ).await?;

    // Cleanup temp audio file
    let _ = tokio::fs::remove_file(&audio_path).await;

    emit_progress(&app, "complete", 100.0, "Transcription complete");

    Ok(result)
}

/// Transcribe audio file directly (already WAV format)
#[tauri::command]
pub async fn transcribe_audio(
    app: AppHandle,
    audio_path: String,
    model_id: String,
    language: Option<String>,
) -> Result<TranscriptionResult> {
    let audio_path = PathBuf::from(audio_path);

    emit_progress(&app, "transcribing", 0.0, "Starting transcription...");

    let whisper_service = WhisperService::new()?;

    let app_handle = app.clone();
    let model_name = model_id.clone();
    let result = whisper_service.transcribe(
        &audio_path,
        &model_id,
        language.as_deref(),
        move |progress| {
            emit_progress(
                &app_handle,
                "transcribing",
                progress,
                &format!("Transcribing with {}...", model_name),
            );
        },
    ).await?;

    emit_progress(&app, "complete", 100.0, "Transcription complete");

    Ok(result)
}

/// Check if Whisper service is available
#[tauri::command]
pub async fn check_whisper_available() -> Result<bool> {
    let service = WhisperService::new()?;
    Ok(service.is_available())
}

/// Install whisper.cpp progress event payload
#[derive(Clone, serde::Serialize)]
pub struct InstallProgress {
    pub percent: f32,
    pub message: String,
}

/// Install whisper.cpp binary
#[tauri::command]
pub async fn install_whisper_cpp(app: AppHandle) -> Result<String> {
    log::info!("[install_whisper_cpp] Starting installation...");
    let app_handle = app.clone();

    let result = WhisperService::install_whisper_cpp(move |percent, message| {
        log::info!("[install_whisper_cpp] Progress: {}% - {}", percent, message);
        let _ = app_handle.emit("whisper:install-progress", InstallProgress {
            percent,
            message,
        });
    }).await;

    match result {
        Ok(path) => {
            log::info!("[install_whisper_cpp] Installation successful: {:?}", path);
            Ok(path.to_string_lossy().to_string())
        }
        Err(e) => {
            log::error!("[install_whisper_cpp] Installation failed: {:?}", e);
            Err(e)
        }
    }
}

fn emit_progress(app: &AppHandle, stage: &str, progress: f32, message: &str) {
    let _ = app.emit("transcription:progress", TranscriptionProgress {
        stage: stage.to_string(),
        progress,
        message: message.to_string(),
    });
}
