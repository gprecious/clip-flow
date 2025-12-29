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
    pub async fn summarize(&self, model: &str, text: &str, language: &str) -> Result<String> {
        let lang_instruction = language_code_to_name(language);

        let system = format!(
            "You are an expert at summarizing transcribed audio/video content. \
             Create a clear, well-structured summary in {}.\n\n\
             Guidelines:\n\
             - Start with a one-sentence overview of the main topic\n\
             - Highlight key points, decisions, or action items\n\
             - Preserve important names, dates, and specific details\n\
             - Use bullet points for multiple items when appropriate\n\
             - Keep the summary concise but comprehensive (aim for 20-30% of original length)\n\
             - Maintain the original tone and context\n\n\
             IMPORTANT: Output ONLY the summary itself. Do NOT include any introductory phrases \
             like \"Here is a summary\" or concluding notes like \"Note:\". \
             Start directly with the summary content.",
            lang_instruction
        );

        let messages = vec![ClaudeMessage {
            role: "user".to_string(),
            content: format!(
                "Summarize the following transcription:\n\n{}",
                text
            ),
        }];

        self.message(model, messages, Some(&system), Some(0.3), 1000)
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

    /// Get available Claude models (static fallback list)
    pub fn available_models() -> Vec<ClaudeModel> {
        vec![
            ClaudeModel {
                id: "claude-3-haiku-20240307".to_string(),
                name: "Claude 3 Haiku".to_string(),
                description: "Fast and affordable".to_string(),
                created_at: String::new(),
            },
            ClaudeModel {
                id: "claude-3-sonnet-20240229".to_string(),
                name: "Claude 3 Sonnet".to_string(),
                description: "Balanced performance".to_string(),
                created_at: String::new(),
            },
            ClaudeModel {
                id: "claude-3-opus-20240229".to_string(),
                name: "Claude 3 Opus".to_string(),
                description: "Most capable".to_string(),
                created_at: String::new(),
            },
            ClaudeModel {
                id: "claude-3-5-sonnet-20241022".to_string(),
                name: "Claude 3.5 Sonnet".to_string(),
                description: "Latest and most intelligent".to_string(),
                created_at: String::new(),
            },
        ]
    }

    /// Fetch available models from Anthropic API (sorted by created date, newest first)
    pub async fn fetch_models(&self) -> Result<Vec<ClaudeModel>> {
        let url = format!("{}/models", CLAUDE_API_BASE);

        let response = self
            .client
            .get(&url)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", CLAUDE_API_VERSION)
            .send()
            .await?;

        if response.status().is_success() {
            let data: AnthropicModelsResponse = response.json().await?;

            // Sort by created_at desc (newest first)
            let mut models: Vec<ClaudeModel> = data
                .data
                .into_iter()
                .map(|m| ClaudeModel {
                    id: m.id.clone(),
                    name: m.display_name,
                    description: String::new(),
                    created_at: m.created_at,
                })
                .collect();

            models.sort_by(|a, b| b.created_at.cmp(&a.created_at));
            Ok(models)
        } else {
            let error_text = response.text().await.unwrap_or_default();
            Err(AppError::Whisper(format!(
                "Failed to fetch Claude models: {}",
                error_text
            )))
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeModel {
    pub id: String,
    pub name: String,
    pub description: String,
    pub created_at: String,
}

// ============================================================================
// Models API Types
// ============================================================================

#[derive(Debug, Clone, Deserialize)]
struct AnthropicModelsResponse {
    data: Vec<AnthropicModelData>,
}

#[derive(Debug, Clone, Deserialize)]
struct AnthropicModelData {
    id: String,
    display_name: String,
    created_at: String,
}

/// Convert language code to full language name for LLM prompts
fn language_code_to_name(code: &str) -> String {
    match code.to_lowercase().as_str() {
        "auto" => "the same language as the original transcription".to_string(),
        "ko" => "Korean".to_string(),
        "en" => "English".to_string(),
        "ja" => "Japanese".to_string(),
        "zh" => "Chinese".to_string(),
        "es" => "Spanish".to_string(),
        "fr" => "French".to_string(),
        "de" => "German".to_string(),
        "pt" => "Portuguese".to_string(),
        "ru" => "Russian".to_string(),
        "it" => "Italian".to_string(),
        "nl" => "Dutch".to_string(),
        "pl" => "Polish".to_string(),
        "tr" => "Turkish".to_string(),
        "vi" => "Vietnamese".to_string(),
        "th" => "Thai".to_string(),
        "id" => "Indonesian".to_string(),
        "ar" => "Arabic".to_string(),
        "hi" => "Hindi".to_string(),
        _ => code.to_string(),
    }
}
