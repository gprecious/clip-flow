use crate::error::{AppError, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};

const CLAUDE_API_BASE: &str = "https://api.anthropic.com/v1";
const CLAUDE_API_VERSION: &str = "2023-06-01";

/// Claude API service for LLM operations
pub struct ClaudeService {
    client: Client,
    api_key: String,
}

// ============================================================================
// Claude API Types
// ============================================================================

#[derive(Debug, Clone, Serialize)]
pub struct ClaudeMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ClaudeRequest {
    pub model: String,
    pub messages: Vec<ClaudeMessage>,
    pub max_tokens: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct ClaudeResponse {
    pub id: String,
    pub content: Vec<ContentBlock>,
    pub model: String,
    pub stop_reason: Option<String>,
    pub usage: ClaudeUsage,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct ContentBlock {
    #[serde(rename = "type")]
    pub content_type: String,
    pub text: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct ClaudeUsage {
    pub input_tokens: u32,
    pub output_tokens: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct ClaudeError {
    #[serde(rename = "type")]
    pub error_type: String,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct ClaudeErrorResponse {
    pub error: ClaudeError,
}

// ============================================================================
// Claude Service Implementation
// ============================================================================

impl ClaudeService {
    /// Create a new Claude service with API key
    pub fn new(api_key: &str) -> Self {
        Self {
            client: Client::new(),
            api_key: api_key.to_string(),
        }
    }

    /// Send a message to Claude
    pub async fn message(
        &self,
        model: &str,
        messages: Vec<ClaudeMessage>,
        system: Option<&str>,
        temperature: Option<f32>,
        max_tokens: u32,
    ) -> Result<String> {
        let url = format!("{}/messages", CLAUDE_API_BASE);

        let request = ClaudeRequest {
            model: model.to_string(),
            messages,
            max_tokens,
            temperature,
            system: system.map(|s| s.to_string()),
        };

        let response = self
            .client
            .post(&url)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", CLAUDE_API_VERSION)
            .header("content-type", "application/json")
            .json(&request)
            .send()
            .await?;

        if response.status().is_success() {
            let result: ClaudeResponse = response.json().await?;
            let text = result
                .content
                .iter()
                .filter_map(|block| block.text.clone())
                .collect::<Vec<_>>()
                .join("");
            Ok(text)
        } else {
            let error_response: ClaudeErrorResponse = response.json().await?;
            Err(AppError::Whisper(format!(
                "Claude API error: {}",
                error_response.error.message
            )))
        }
    }

    /// Summarize text using Claude
    pub async fn summarize(&self, text: &str, language: &str) -> Result<String> {
        let system = format!(
            "You are a helpful assistant that summarizes transcriptions in {}. \
             Provide concise, well-structured summaries that capture the key points.",
            language
        );

        let messages = vec![ClaudeMessage {
            role: "user".to_string(),
            content: format!(
                "Please summarize the following transcription:\n\n{}",
                text
            ),
        }];

        self.message(
            "claude-3-haiku-20240307",
            messages,
            Some(&system),
            Some(0.3),
            1000,
        )
        .await
    }

    /// Check if API key is valid
    pub async fn validate_api_key(&self) -> Result<bool> {
        // Send a minimal request to check if key is valid
        let messages = vec![ClaudeMessage {
            role: "user".to_string(),
            content: "Hi".to_string(),
        }];

        let result = self
            .message("claude-3-haiku-20240307", messages, None, None, 10)
            .await;

        Ok(result.is_ok())
    }

    /// Get available Claude models
    pub fn available_models() -> Vec<ClaudeModel> {
        vec![
            ClaudeModel {
                id: "claude-3-haiku-20240307".to_string(),
                name: "Claude 3 Haiku".to_string(),
                description: "Fast and affordable".to_string(),
            },
            ClaudeModel {
                id: "claude-3-sonnet-20240229".to_string(),
                name: "Claude 3 Sonnet".to_string(),
                description: "Balanced performance".to_string(),
            },
            ClaudeModel {
                id: "claude-3-opus-20240229".to_string(),
                name: "Claude 3 Opus".to_string(),
                description: "Most capable".to_string(),
            },
            ClaudeModel {
                id: "claude-3-5-sonnet-20241022".to_string(),
                name: "Claude 3.5 Sonnet".to_string(),
                description: "Latest and most intelligent".to_string(),
            },
        ]
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ClaudeModel {
    pub id: String,
    pub name: String,
    pub description: String,
}
