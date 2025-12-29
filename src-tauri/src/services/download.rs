use crate::error::{AppError, Result};
use futures::StreamExt;
use reqwest::Client;
use std::path::PathBuf;
use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;

/// Model information for Whisper models
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WhisperModel {
    pub id: String,
    pub name: String,
    pub description: String,
    pub size_bytes: u64,
    pub size_display: String,
    pub url: String,
    pub sha256: Option<String>,
}

impl WhisperModel {
    /// Get available Whisper models with download URLs
    pub fn available_models() -> Vec<WhisperModel> {
        vec![
            WhisperModel {
                id: "tiny".to_string(),
                name: "Tiny".to_string(),
                description: "tiny".to_string(),
                size_bytes: 77_700_000,
                size_display: "78 MB".to_string(),
                url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin".to_string(),
                sha256: None,
            },
            WhisperModel {
                id: "base".to_string(),
                name: "Base".to_string(),
                description: "base".to_string(),
                size_bytes: 148_000_000,
                size_display: "148 MB".to_string(),
                url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin".to_string(),
                sha256: None,
            },
            WhisperModel {
                id: "small".to_string(),
                name: "Small".to_string(),
                description: "small".to_string(),
                size_bytes: 488_000_000,
                size_display: "488 MB".to_string(),
                url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin".to_string(),
                sha256: None,
            },
            WhisperModel {
                id: "medium".to_string(),
                name: "Medium".to_string(),
                description: "medium".to_string(),
                size_bytes: 1_530_000_000,
                size_display: "1.5 GB".to_string(),
                url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin".to_string(),
                sha256: None,
            },
            WhisperModel {
                id: "large-v1".to_string(),
                name: "Large v1".to_string(),
                description: "largeV1".to_string(),
                size_bytes: 3_090_000_000,
                size_display: "3.1 GB".to_string(),
                url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v1.bin".to_string(),
                sha256: None,
            },
            WhisperModel {
                id: "large-v2".to_string(),
                name: "Large v2".to_string(),
                description: "largeV2".to_string(),
                size_bytes: 3_090_000_000,
                size_display: "3.1 GB".to_string(),
                url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v2.bin".to_string(),
                sha256: None,
            },
            WhisperModel {
                id: "large-v3".to_string(),
                name: "Large v3".to_string(),
                description: "largeV3".to_string(),
                size_bytes: 3_100_000_000,
                size_display: "3.1 GB".to_string(),
                url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin".to_string(),
                sha256: None,
            },
            WhisperModel {
                id: "large-v3-turbo".to_string(),
                name: "Large v3 Turbo".to_string(),
                description: "largeV3Turbo".to_string(),
                size_bytes: 1_620_000_000,
                size_display: "1.6 GB".to_string(),
                url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin".to_string(),
                sha256: None,
            },
        ]
    }
}

/// Download service for managing model downloads
pub struct DownloadService {
    client: Client,
    models_dir: PathBuf,
}

impl DownloadService {
    /// Create a new download service
    pub fn new() -> Result<Self> {
        let models_dir = Self::get_models_directory()?;

        Ok(Self {
            client: Client::new(),
            models_dir,
        })
    }

    /// Get the models directory path
    pub fn get_models_directory() -> Result<PathBuf> {
        let data_dir = dirs::data_local_dir()
            .ok_or_else(|| AppError::InvalidPath("Cannot find data directory".to_string()))?;

        Ok(data_dir.join("clip-flow").join("models"))
    }

    /// Ensure the models directory exists
    pub async fn ensure_models_directory(&self) -> Result<()> {
        fs::create_dir_all(&self.models_dir).await?;
        Ok(())
    }

    /// Get list of installed models
    pub async fn get_installed_models(&self) -> Result<Vec<String>> {
        self.ensure_models_directory().await?;

        let mut installed = Vec::new();
        let mut entries = fs::read_dir(&self.models_dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if path.extension().map(|e| e == "bin").unwrap_or(false) {
                if let Some(stem) = path.file_stem() {
                    let model_id = stem.to_string_lossy()
                        .trim_start_matches("ggml-")
                        .to_string();
                    installed.push(model_id);
                }
            }
        }

        Ok(installed)
    }

    /// Check if a model is installed
    pub async fn is_model_installed(&self, model_id: &str) -> Result<bool> {
        let model_path = self.get_model_path(model_id);
        Ok(model_path.exists())
    }

    /// Get the path to a model file
    pub fn get_model_path(&self, model_id: &str) -> PathBuf {
        self.models_dir.join(format!("ggml-{}.bin", model_id))
    }

    /// Download a Whisper model with progress callback
    pub async fn download_model<F>(
        &self,
        model_id: &str,
        on_progress: F,
    ) -> Result<PathBuf>
    where
        F: Fn(DownloadProgress) + Send + 'static,
    {
        self.ensure_models_directory().await?;

        // Find model info
        let model = WhisperModel::available_models()
            .into_iter()
            .find(|m| m.id == model_id)
            .ok_or_else(|| AppError::ModelNotFound(model_id.to_string()))?;

        let output_path = self.get_model_path(model_id);
        let temp_path = output_path.with_extension("bin.tmp");

        // Start download
        let response = self.client
            .get(&model.url)
            .send()
            .await?;

        let total_size = response.content_length().unwrap_or(model.size_bytes);
        let mut downloaded: u64 = 0;

        // Create temp file
        let mut file = File::create(&temp_path).await?;
        let mut stream = response.bytes_stream();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| AppError::Download(e.to_string()))?;
            file.write_all(&chunk).await?;

            downloaded += chunk.len() as u64;
            let progress = DownloadProgress {
                downloaded,
                total: total_size,
                percent: (downloaded as f64 / total_size as f64 * 100.0) as f32,
                model_id: model_id.to_string(),
            };
            on_progress(progress);
        }

        file.flush().await?;
        drop(file);

        // Rename temp file to final name
        fs::rename(&temp_path, &output_path).await?;

        Ok(output_path)
    }

    /// Delete a downloaded model
    pub async fn delete_model(&self, model_id: &str) -> Result<()> {
        let model_path = self.get_model_path(model_id);
        if model_path.exists() {
            fs::remove_file(&model_path).await?;
        }
        Ok(())
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    pub percent: f32,
    pub model_id: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ModelStatus {
    pub id: String,
    pub name: String,
    pub description: String,
    pub size_display: String,
    pub installed: bool,
    pub path: Option<String>,
}
