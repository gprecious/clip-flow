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
    /// Legacy parameter for older models (gpt-3.5, gpt-4)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    /// New parameter for newer models (gpt-4o, gpt-5, o1, o3)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_completion_tokens: Option<u32>,
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

        // Newer models (gpt-4o, gpt-5, o1, o3) use max_completion_tokens
        // Legacy models (gpt-3.5, gpt-4) use max_tokens
        let use_new_param = Self::uses_max_completion_tokens(model);

        let request = ChatRequest {
            model: model.to_string(),
            messages,
            temperature,
            max_tokens: if use_new_param { None } else { max_tokens },
            max_completion_tokens: if use_new_param { max_tokens } else { None },
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
    pub async fn summarize(&self, model: &str, text: &str, language: &str) -> Result<String> {
        let lang_instruction = language_code_to_name(language);

        let messages = vec![
            ChatMessage {
                role: "system".to_string(),
                content: format!(
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
                ),
            },
            ChatMessage {
                role: "user".to_string(),
                content: format!(
                    "Summarize the following transcription:\n\n{}",
                    text
                ),
            },
        ];

        self.chat(model, messages, Some(0.3), Some(1000)).await
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

    /// Get available OpenAI models (static fallback list)
    pub fn available_models() -> Vec<OpenAIModel> {
        vec![
            OpenAIModel {
                id: "gpt-4o-mini".to_string(),
                name: "GPT-4o Mini".to_string(),
                description: "Fast and affordable".to_string(),
                created: 0,
            },
            OpenAIModel {
                id: "gpt-4o".to_string(),
                name: "GPT-4o".to_string(),
                description: "Most capable".to_string(),
                created: 0,
            },
            OpenAIModel {
                id: "gpt-4-turbo".to_string(),
                name: "GPT-4 Turbo".to_string(),
                description: "Faster GPT-4".to_string(),
                created: 0,
            },
            OpenAIModel {
                id: "gpt-3.5-turbo".to_string(),
                name: "GPT-3.5 Turbo".to_string(),
                description: "Legacy, fast".to_string(),
                created: 0,
            },
        ]
    }

    /// Fetch available models from OpenAI API (sorted by created date, newest first)
    pub async fn fetch_models(&self) -> Result<Vec<OpenAIModel>> {
        let url = format!("{}/models", OPENAI_API_BASE);

        let response = self
            .client
            .get(&url)
            .bearer_auth(&self.api_key)
            .send()
            .await?;

        if response.status().is_success() {
            let data: OpenAIModelsResponse = response.json().await?;

            // Filter chat-compatible models only (whitelist approach)
            let mut models: Vec<OpenAIModel> = data
                .data
                .into_iter()
                .filter(|m| is_chat_compatible_model(&m.id))
                .map(|m| OpenAIModel {
                    id: m.id.clone(),
                    name: format_model_name(&m.id),
                    description: String::new(),
                    created: m.created,
                })
                .collect();

            // Sort by created desc (newest first)
            models.sort_by(|a, b| b.created.cmp(&a.created));
            Ok(models)
        } else {
            let error_text = response.text().await.unwrap_or_default();
            Err(AppError::Whisper(format!(
                "Failed to fetch OpenAI models: {}",
                error_text
            )))
        }
    }

    /// Check if a model uses max_completion_tokens instead of max_tokens.
    /// Newer models (gpt-4o, gpt-5, o-series) require max_completion_tokens.
    /// Legacy models (gpt-3.5, gpt-4, gpt-4-turbo) use max_tokens.
    fn uses_max_completion_tokens(model: &str) -> bool {
        // O-series models always use max_completion_tokens
        if model.starts_with('o') && model.chars().nth(1).is_some_and(|c| c.is_ascii_digit()) {
            return true;
        }

        // GPT-4o and newer use max_completion_tokens
        if model.starts_with("gpt-4o") || model.starts_with("gpt-4.") {
            return true;
        }

        // GPT-5 and above use max_completion_tokens
        if model.starts_with("gpt-") {
            let rest = &model[4..];
            // Parse major version number (handles 5, 6, 10, etc.)
            let version_str: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
            if let Ok(version) = version_str.parse::<u32>() {
                return version >= 5;
            }
        }

        false
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIModel {
    pub id: String,
    pub name: String,
    pub description: String,
    pub created: i64,
}

// ============================================================================
// Models API Types
// ============================================================================

#[derive(Debug, Clone, Deserialize)]
struct OpenAIModelsResponse {
    data: Vec<OpenAIModelData>,
}

#[derive(Debug, Clone, Deserialize)]
struct OpenAIModelData {
    id: String,
    created: i64,
}

/// Format model ID to display name
fn format_model_name(id: &str) -> String {
    // Convert model ID to a more readable name
    // e.g., "gpt-4o-mini" -> "GPT-4o Mini"
    id.replace("gpt-", "GPT-")
        .replace("-mini", " Mini")
        .replace("-turbo", " Turbo")
        .replace("-preview", " Preview")
}

/// Allowed model size/variant suffixes for chat models
const ALLOWED_SUFFIXES: &[&str] = &["mini", "nano", "turbo", "preview", "latest"];

/// Non-chat model keywords - models containing these are NOT chat-compatible
const NON_CHAT_KEYWORDS: &[&str] = &[
    "tts",        // Text-to-speech
    "transcribe", // Speech-to-text
    "realtime",   // Realtime API
    "audio",      // Audio models
    "vision",     // Vision-only models
    "image",      // Image generation
    "embedding",  // Embedding models
    "moderation", // Moderation models
    "instruct",   // Instruct models
    "search",     // Search models
    "similarity", // Similarity models
    "edit",       // Edit models
    "code",       // Codex models
    "whisper",    // Whisper
    "dall-e",     // DALL-E
    "davinci",    // Legacy
    "babbage",    // Legacy
    "curie",      // Legacy
    "ada",        // Legacy
];

/// Check if a model ID is compatible with the Chat Completions API.
/// Uses dynamic pattern matching - no hardcoded model list.
///
/// Allowed patterns:
///   - gpt-{version} (gpt-4, gpt-5, gpt-4.1, gpt-10)
///   - gpt-{version}o (gpt-4o, gpt-5o)
///   - gpt-{version}-{suffix} (gpt-4-turbo, gpt-5-mini, gpt-4o-mini)
///   - gpt-{version}o-{suffix} (gpt-4o-mini)
///   - o{number} (o1, o3, o10)
///   - o{number}-{suffix} (o1-mini, o3-pro)
///   - chatgpt-* (chatgpt-4o-latest)
///
/// NOT allowed:
///   - Date versions (gpt-4o-2024-11-20) - excluded
///   - Non-chat variants (gpt-4o-realtime, gpt-4o-audio) - excluded
fn is_chat_compatible_model(model_id: &str) -> bool {
    // First, check blacklist keywords
    for keyword in NON_CHAT_KEYWORDS {
        if model_id.contains(keyword) {
            return false;
        }
    }

    // Check for date version pattern (ends with -YYYY-MM-DD or -NNNN)
    // These are versioned snapshots, not main models
    if has_date_suffix(model_id) {
        return false;
    }

    // Pattern 1: gpt-{version}[o][-suffix]
    if model_id.starts_with("gpt-") {
        return is_valid_gpt_model(&model_id[4..]);
    }

    // Pattern 2: o{digit}[-suffix]
    if model_id.starts_with('o') && model_id.len() > 1 {
        let rest = &model_id[1..];
        if let Some(first_char) = rest.chars().next() {
            if first_char.is_ascii_digit() {
                return is_valid_o_series(rest);
            }
        }
    }

    // Pattern 3: chatgpt-*
    if model_id.starts_with("chatgpt-") {
        return true;
    }

    false
}

/// Check if a model ID ends with a date pattern (-YYYY-MM-DD or -NNNN)
fn has_date_suffix(model_id: &str) -> bool {
    // Look for pattern like -2024-11-20 or -0613
    if let Some(last_dash) = model_id.rfind('-') {
        let suffix = &model_id[last_dash + 1..];
        // Check if suffix is all digits (date component)
        if suffix.len() >= 4 && suffix.chars().all(|c| c.is_ascii_digit()) {
            return true;
        }
    }
    false
}

/// Validate GPT model format: {version}[o][-suffix]
/// Examples: 4, 4o, 4-turbo, 4o-mini, 4.1, 4.1-mini, 5, 5o-mini
fn is_valid_gpt_model(rest: &str) -> bool {
    // Parse version number (can be like "4", "4.1", "10", "3.5")
    let mut chars = rest.chars().peekable();

    // Must start with digit
    if !chars.peek().is_some_and(|c| c.is_ascii_digit()) {
        return false;
    }

    // Consume version number (digits and optional decimal)
    while chars.peek().is_some_and(|c| c.is_ascii_digit() || *c == '.') {
        chars.next();
    }

    // Optional 'o' suffix (for gpt-4o style)
    if chars.peek() == Some(&'o') {
        chars.next();
    }

    // If nothing left, it's a base model (gpt-4, gpt-4o, gpt-5)
    if chars.peek().is_none() {
        return true;
    }

    // Must be followed by '-' and a valid suffix
    if chars.next() != Some('-') {
        return false;
    }

    let suffix: String = chars.collect();
    ALLOWED_SUFFIXES.contains(&suffix.as_str())
}

/// Validate O-series model format: {digit}[-suffix]
/// Examples: 1, 1-mini, 3, 3-pro, 10, 10-mini
fn is_valid_o_series(rest: &str) -> bool {
    let mut chars = rest.chars().peekable();

    // Consume digits
    while chars.peek().is_some_and(|c| c.is_ascii_digit()) {
        chars.next();
    }

    // If nothing left, it's a base model (o1, o3, o10)
    if chars.peek().is_none() {
        return true;
    }

    // Must be followed by '-' and a valid suffix
    if chars.next() != Some('-') {
        return false;
    }

    let suffix: String = chars.collect();
    ALLOWED_SUFFIXES.contains(&suffix.as_str())
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

#[cfg(test)]
mod tests {
    use super::*;

    // =========================================================================
    // is_chat_compatible_model tests
    // =========================================================================

    mod chat_compatible {
        use super::*;

        #[test]
        fn gpt_base_models() {
            // Integer versions
            assert!(is_chat_compatible_model("gpt-4"));
            assert!(is_chat_compatible_model("gpt-5"));
            assert!(is_chat_compatible_model("gpt-6"));
            assert!(is_chat_compatible_model("gpt-10"));

            // Decimal versions
            assert!(is_chat_compatible_model("gpt-3.5"));
            assert!(is_chat_compatible_model("gpt-4.1"));
            assert!(is_chat_compatible_model("gpt-5.2"));

            // With 'o' suffix
            assert!(is_chat_compatible_model("gpt-4o"));
            assert!(is_chat_compatible_model("gpt-5o"));
            assert!(is_chat_compatible_model("gpt-4.1o"));
        }

        #[test]
        fn gpt_with_size_suffix() {
            // mini
            assert!(is_chat_compatible_model("gpt-4o-mini"));
            assert!(is_chat_compatible_model("gpt-5-mini"));
            assert!(is_chat_compatible_model("gpt-5o-mini"));
            assert!(is_chat_compatible_model("gpt-4.1-mini"));

            // nano
            assert!(is_chat_compatible_model("gpt-5-nano"));
            assert!(is_chat_compatible_model("gpt-4.1-nano"));

            // turbo
            assert!(is_chat_compatible_model("gpt-4-turbo"));
            assert!(is_chat_compatible_model("gpt-3.5-turbo"));
            assert!(is_chat_compatible_model("gpt-6-turbo"));

            // preview
            assert!(is_chat_compatible_model("gpt-5-preview"));

            // latest
            assert!(is_chat_compatible_model("gpt-5-latest"));
        }

        #[test]
        fn o_series_base() {
            assert!(is_chat_compatible_model("o1"));
            assert!(is_chat_compatible_model("o3"));
            assert!(is_chat_compatible_model("o4"));
            assert!(is_chat_compatible_model("o10"));
            assert!(is_chat_compatible_model("o99"));
        }

        #[test]
        fn o_series_with_suffix() {
            assert!(is_chat_compatible_model("o1-mini"));
            assert!(is_chat_compatible_model("o1-preview"));
            assert!(is_chat_compatible_model("o3-mini"));
            assert!(is_chat_compatible_model("o4-mini"));
            assert!(is_chat_compatible_model("o4-nano"));
        }

        #[test]
        fn chatgpt_models() {
            assert!(is_chat_compatible_model("chatgpt-4o-latest"));
            assert!(is_chat_compatible_model("chatgpt-5-latest"));
            assert!(is_chat_compatible_model("chatgpt-anything"));
        }
    }

    mod chat_incompatible {
        use super::*;

        #[test]
        fn date_versioned_models() {
            assert!(!is_chat_compatible_model("gpt-4o-2024-11-20"));
            assert!(!is_chat_compatible_model("gpt-4o-mini-2024-07-18"));
            assert!(!is_chat_compatible_model("gpt-4-0613"));
            assert!(!is_chat_compatible_model("gpt-3.5-turbo-0125"));
            assert!(!is_chat_compatible_model("o1-2024-12-17"));
            assert!(!is_chat_compatible_model("gpt-5-2025-08-07"));
        }

        #[test]
        fn non_chat_variants() {
            // realtime
            assert!(!is_chat_compatible_model("gpt-4o-realtime"));
            assert!(!is_chat_compatible_model("gpt-4o-realtime-preview"));

            // audio
            assert!(!is_chat_compatible_model("gpt-4o-audio"));
            assert!(!is_chat_compatible_model("gpt-4o-audio-preview"));

            // tts / transcribe
            assert!(!is_chat_compatible_model("gpt-4o-mini-tts"));
            assert!(!is_chat_compatible_model("gpt-4o-mini-transcribe"));

            // image
            assert!(!is_chat_compatible_model("gpt-image-1"));

            // vision
            assert!(!is_chat_compatible_model("gpt-4-vision"));
        }

        #[test]
        fn pro_suffix_excluded() {
            assert!(!is_chat_compatible_model("o1-pro"));
            assert!(!is_chat_compatible_model("o3-pro"));
            assert!(!is_chat_compatible_model("gpt-5-pro"));
        }

        #[test]
        fn non_gpt_models() {
            assert!(!is_chat_compatible_model("dall-e-3"));
            assert!(!is_chat_compatible_model("whisper-1"));
            assert!(!is_chat_compatible_model("text-embedding-3-large"));
            assert!(!is_chat_compatible_model("davinci-002"));
            assert!(!is_chat_compatible_model("babbage-002"));
            assert!(!is_chat_compatible_model("ada-002"));
        }

        #[test]
        fn invalid_formats() {
            assert!(!is_chat_compatible_model("gpt-"));
            assert!(!is_chat_compatible_model("gpt-abc"));
            assert!(!is_chat_compatible_model("o"));
            assert!(!is_chat_compatible_model("omni"));
            assert!(!is_chat_compatible_model(""));
        }
    }

    // =========================================================================
    // uses_max_completion_tokens tests
    // =========================================================================

    mod max_tokens_param {
        use super::*;

        #[test]
        fn legacy_models_use_max_tokens() {
            assert!(!OpenAIService::uses_max_completion_tokens("gpt-3.5"));
            assert!(!OpenAIService::uses_max_completion_tokens("gpt-3.5-turbo"));
            assert!(!OpenAIService::uses_max_completion_tokens("gpt-4"));
            assert!(!OpenAIService::uses_max_completion_tokens("gpt-4-turbo"));
        }

        #[test]
        fn newer_models_use_max_completion_tokens() {
            // gpt-4o series
            assert!(OpenAIService::uses_max_completion_tokens("gpt-4o"));
            assert!(OpenAIService::uses_max_completion_tokens("gpt-4o-mini"));

            // gpt-4.x series
            assert!(OpenAIService::uses_max_completion_tokens("gpt-4.1"));
            assert!(OpenAIService::uses_max_completion_tokens("gpt-4.1-mini"));

            // gpt-5+ series
            assert!(OpenAIService::uses_max_completion_tokens("gpt-5"));
            assert!(OpenAIService::uses_max_completion_tokens("gpt-5-mini"));
            assert!(OpenAIService::uses_max_completion_tokens("gpt-5.2"));
            assert!(OpenAIService::uses_max_completion_tokens("gpt-6"));
            assert!(OpenAIService::uses_max_completion_tokens("gpt-10"));
        }

        #[test]
        fn o_series_use_max_completion_tokens() {
            assert!(OpenAIService::uses_max_completion_tokens("o1"));
            assert!(OpenAIService::uses_max_completion_tokens("o1-mini"));
            assert!(OpenAIService::uses_max_completion_tokens("o1-preview"));
            assert!(OpenAIService::uses_max_completion_tokens("o3"));
            assert!(OpenAIService::uses_max_completion_tokens("o3-mini"));
            assert!(OpenAIService::uses_max_completion_tokens("o4"));
            assert!(OpenAIService::uses_max_completion_tokens("o4-mini"));
        }
    }
}
