use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("FFmpeg error: {0}")]
    FFmpeg(String),

    #[error("Whisper error: {0}")]
    Whisper(String),

    #[error("Download error: {0}")]
    Download(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Model not found: {0}")]
    ModelNotFound(String),

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("Process failed: {0}")]
    ProcessFailed(String),

    #[error("Keychain error: {0}")]
    Keychain(String),
}

// Make AppError serializable for Tauri commands
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ffmpeg_error_display() {
        let error = AppError::FFmpeg("conversion failed".to_string());
        assert_eq!(error.to_string(), "FFmpeg error: conversion failed");
    }

    #[test]
    fn test_whisper_error_display() {
        let error = AppError::Whisper("transcription failed".to_string());
        assert_eq!(error.to_string(), "Whisper error: transcription failed");
    }

    #[test]
    fn test_download_error_display() {
        let error = AppError::Download("connection timeout".to_string());
        assert_eq!(error.to_string(), "Download error: connection timeout");
    }

    #[test]
    fn test_model_not_found_error_display() {
        let error = AppError::ModelNotFound("large-v2".to_string());
        assert_eq!(error.to_string(), "Model not found: large-v2");
    }

    #[test]
    fn test_invalid_path_error_display() {
        let error = AppError::InvalidPath("/invalid/path".to_string());
        assert_eq!(error.to_string(), "Invalid path: /invalid/path");
    }

    #[test]
    fn test_process_failed_error_display() {
        let error = AppError::ProcessFailed("exit code 1".to_string());
        assert_eq!(error.to_string(), "Process failed: exit code 1");
    }

    #[test]
    fn test_io_error_from_conversion() {
        let io_error = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let app_error: AppError = io_error.into();
        assert!(app_error.to_string().contains("file not found"));
    }

    #[test]
    fn test_error_serialization() {
        let error = AppError::FFmpeg("test error".to_string());
        let serialized = serde_json::to_string(&error).unwrap();
        assert_eq!(serialized, "\"FFmpeg error: test error\"");
    }
}
