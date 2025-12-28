use crate::error::{AppError, Result};
use reqwest::{multipart, Client};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tokio::fs::File;
use tokio::io::AsyncReadExt;

const OPENAI_API_BASE: &str = "https://api.openai.com/v1";

/// OpenAI API service for Whisper and GPT
pub struct OpenAIService {
    client: Client,
    api_key: String,
}

// ============================================================================
// Whisper API Types
// ============================================================================

#[derive(Debug, Clone, Serialize)]
#[allow(dead_code)]
pub struct WhisperRequest {
    pub model: String,
    pub language: Option<String>,
    pub response_format: Option<String>,
    pub temperature: Option<f32>,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct WhisperResponse {
    pub text: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct WhisperVerboseResponse {
    pub text: String,
    pub segments: Option<Vec<WhisperSegment>>,
    pub language: Option<String>,
    pub duration: Option<f64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct WhisperSegment {
    pub id: i32,
    pub start: f64,
    pub end: f64,
    pub text: String,
}

// ============================================================================
// Chat API Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[allow(dead_code)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct ChatResponse {
    pub id: String,
    pub choices: Vec<ChatChoice>,
    pub usage: Option<Usage>,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct ChatChoice {
    pub index: i32,
    pub message: ChatMessage,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct Usage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

// ============================================================================
// OpenAI Service Implementation
// ============================================================================

impl OpenAIService {
    /// Create a new OpenAI service with API key
    pub fn new(api_key: &str) -> Self {
        Self {
            client: Client::new(),
            api_key: api_key.to_string(),
        }
    }

    /// Transcribe audio file using Whisper API
    pub async fn transcribe(
        &self,
        audio_path: &Path,
        language: Option<&str>,
    ) -> Result<WhisperVerboseResponse> {
        let url = format!("{}/audio/transcriptions", OPENAI_API_BASE);

        // Read audio file
        let mut file = File::open(audio_path).await?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer).await?;

        let filename = audio_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("audio.wav")
            .to_string();

        // Build multipart form
        let file_part = multipart::Part::bytes(buffer)
            .file_name(filename)
            .mime_str("audio/wav")
            .map_err(|e: reqwest::Error| AppError::Whisper(e.to_string()))?;

        let mut form = multipart::Form::new()
            .part("file", file_part)
            .text("model", "whisper-1")
            .text("response_format", "verbose_json");

        if let Some(lang) = language {
            form = form.text("language", lang.to_string());
        }

        let response: reqwest::Response = self
            .client
            .post(&url)
            .bearer_auth(&self.api_key)
            .multipart(form)
            .send()
            .await?;

        if response.status().is_success() {
            let result: WhisperVerboseResponse = response.json().await?;
            Ok(result)
        } else {
            let error_text: String = response.text().await.unwrap_or_default();
            Err(AppError::Whisper(format!(
                "OpenAI Whisper API error: {}",
                error_text
            )))
        }
    }

    /// Chat completion using GPT models
    pub async fn chat(
        &self,
        model: &str,
        messages: Vec<ChatMessage>,
        temperature: Option<f32>,
        max_tokens: Option<u32>,
    ) -> Result<String> {
        let url = format!("{}/chat/completions", OPENAI_API_BASE);

        let request = ChatRequest {
            model: model.to_string(),
            messages,
            temperature,
            max_tokens,
            stream: Some(false),
        };

        let response = self
            .client
            .post(&url)
            .bearer_auth(&self.api_key)
            .json(&request)
            .send()
            .await?;

        if response.status().is_success() {
            let result: ChatResponse = response.json().await?;
            let content = result
                .choices
                .first()
                .map(|c| c.message.content.clone())
                .unwrap_or_default();
            Ok(content)
        } else {
            let error_text = response.text().await.unwrap_or_default();
            Err(AppError::Whisper(format!(
                "OpenAI Chat API error: {}",
                error_text
            )))
        }
    }

    /// Summarize text using GPT
    pub async fn summarize(&self, text: &str, language: &str) -> Result<String> {
        let messages = vec![
            ChatMessage {
                role: "system".to_string(),
                content: format!(
                    "You are a helpful assistant that summarizes transcriptions in {}. \
                     Provide concise, well-structured summaries.",
                    language
                ),
            },
            ChatMessage {
                role: "user".to_string(),
                content: format!(
                    "Please summarize the following transcription:\n\n{}",
                    text
                ),
            },
        ];

        self.chat("gpt-4o-mini", messages, Some(0.3), Some(1000))
            .await
    }

    /// Check if API key is valid
    pub async fn validate_api_key(&self) -> Result<bool> {
        let url = format!("{}/models", OPENAI_API_BASE);

        let response = self
            .client
            .get(&url)
            .bearer_auth(&self.api_key)
            .send()
            .await?;

        Ok(response.status().is_success())
    }

    /// Get available OpenAI models
    pub fn available_models() -> Vec<OpenAIModel> {
        vec![
            OpenAIModel {
                id: "gpt-4o-mini".to_string(),
                name: "GPT-4o Mini".to_string(),
                description: "Fast and affordable".to_string(),
            },
            OpenAIModel {
                id: "gpt-4o".to_string(),
                name: "GPT-4o".to_string(),
                description: "Most capable".to_string(),
            },
            OpenAIModel {
                id: "gpt-4-turbo".to_string(),
                name: "GPT-4 Turbo".to_string(),
                description: "Faster GPT-4".to_string(),
            },
            OpenAIModel {
                id: "gpt-3.5-turbo".to_string(),
                name: "GPT-3.5 Turbo".to_string(),
                description: "Legacy, fast".to_string(),
            },
        ]
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct OpenAIModel {
    pub id: String,
    pub name: String,
    pub description: String,
}
