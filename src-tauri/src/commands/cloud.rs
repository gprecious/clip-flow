use crate::error::Result;
use crate::services::{
    keychain::{ApiKeyType, KeychainService},
    ClaudeModel, ClaudeService, OpenAIModel, OpenAIService,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// ============================================================================
// API Key Management Commands
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyStatus {
    pub openai: bool,
    pub claude: bool,
}

/// Store an API key securely
#[tauri::command]
pub fn store_api_key(provider: &str, api_key: &str) -> Result<()> {
    println!("[store_api_key] Called with provider: {}, key length: {}", provider, api_key.len());
    let result = match provider.to_lowercase().as_str() {
        "openai" => KeychainService::store_openai_key(api_key),
        "claude" => KeychainService::store_claude_key(api_key),
        _ => Err(crate::error::AppError::ProcessFailed(format!(
            "Unknown provider: {}",
            provider
        ))),
    };
    println!("[store_api_key] Store result: {:?}", result.is_ok());

    // Verify storage immediately after
    let verify = match provider.to_lowercase().as_str() {
        "openai" => KeychainService::get_openai_key(),
        "claude" => KeychainService::get_claude_key(),
        _ => Ok(None),
    };
    println!("[store_api_key] Verification - key exists: {:?}", verify.as_ref().map(|v| v.is_some()));
    if let Err(ref e) = verify {
        println!("[store_api_key] Verification error: {:?}", e);
    }

    result
}

/// Get API key (returns masked version for UI)
#[tauri::command]
pub fn get_api_key_masked(provider: &str) -> Result<Option<String>> {
    let key = match provider.to_lowercase().as_str() {
        "openai" => KeychainService::get_openai_key()?,
        "claude" => KeychainService::get_claude_key()?,
        _ => None,
    };

    // Return masked version (show only last 4 chars)
    Ok(key.map(|k| {
        if k.len() > 4 {
            format!("{}...{}", &k[..4], &k[k.len() - 4..])
        } else {
            "****".to_string()
        }
    }))
}

/// Delete an API key
#[tauri::command]
pub fn delete_api_key(provider: &str) -> Result<()> {
    match provider.to_lowercase().as_str() {
        "openai" => KeychainService::delete_api_key(ApiKeyType::OpenAI),
        "claude" => KeychainService::delete_api_key(ApiKeyType::Claude),
        _ => Err(crate::error::AppError::ProcessFailed(format!(
            "Unknown provider: {}",
            provider
        ))),
    }
}

/// Check which API keys are configured
#[tauri::command]
pub fn get_api_key_status() -> Result<ApiKeyStatus> {
    Ok(ApiKeyStatus {
        openai: KeychainService::has_api_key(ApiKeyType::OpenAI)?,
        claude: KeychainService::has_api_key(ApiKeyType::Claude)?,
    })
}

// ============================================================================
// OpenAI Commands
// ============================================================================

/// Validate OpenAI API key
#[tauri::command]
pub async fn validate_openai_key() -> Result<bool> {
    let api_key = KeychainService::get_openai_key()?
        .ok_or_else(|| crate::error::AppError::ProcessFailed("OpenAI API key not set".into()))?;

    let service = OpenAIService::new(&api_key);
    service.validate_api_key().await
}

/// Transcribe audio using OpenAI Whisper API
#[tauri::command]
pub async fn openai_transcribe(audio_path: String, language: Option<String>, model: Option<String>) -> Result<OpenAITranscriptionResult> {
    let api_key = KeychainService::get_openai_key()?
        .ok_or_else(|| crate::error::AppError::ProcessFailed("OpenAI API key not set".into()))?;

    let service = OpenAIService::new(&api_key);
    let path = PathBuf::from(&audio_path);
    let result = service.transcribe(&path, language.as_deref(), model.as_deref()).await?;

    Ok(OpenAITranscriptionResult {
        text: result.text,
        language: result.language,
        duration: result.duration,
        segments: result.segments.map(|segs| {
            segs.into_iter()
                .map(|s| TranscriptionSegment {
                    id: s.id as u32,
                    start: s.start,
                    end: s.end,
                    text: s.text,
                })
                .collect()
        }),
    })
}

/// Chat with OpenAI GPT
#[tauri::command]
pub async fn openai_chat(
    model: String,
    messages: Vec<ChatMessageInput>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
) -> Result<String> {
    let api_key = KeychainService::get_openai_key()?
        .ok_or_else(|| crate::error::AppError::ProcessFailed("OpenAI API key not set".into()))?;

    let service = OpenAIService::new(&api_key);
    let msgs: Vec<crate::services::openai::ChatMessage> = messages
        .into_iter()
        .map(|m| crate::services::openai::ChatMessage {
            role: m.role,
            content: m.content,
        })
        .collect();

    service.chat(&model, msgs, temperature, max_tokens).await
}

/// Summarize text using OpenAI GPT
#[tauri::command]
pub async fn openai_summarize(text: String, language: String, model: String) -> Result<String> {
    let api_key = KeychainService::get_openai_key()?
        .ok_or_else(|| crate::error::AppError::ProcessFailed("OpenAI API key not set".into()))?;

    let service = OpenAIService::new(&api_key);
    service.summarize(&model, &text, &language).await
}

/// Get available OpenAI models (static list)
#[tauri::command]
pub fn get_openai_models() -> Vec<OpenAIModel> {
    OpenAIService::available_models()
}

/// Fetch available OpenAI models from API (dynamic, sorted by newest)
#[tauri::command]
pub async fn fetch_openai_models() -> Result<Vec<OpenAIModel>> {
    let api_key = KeychainService::get_openai_key()?
        .ok_or_else(|| crate::error::AppError::ProcessFailed("OpenAI API key not set".into()))?;

    let service = OpenAIService::new(&api_key);
    service.fetch_models().await
}

// ============================================================================
// Claude Commands
// ============================================================================

/// Validate Claude API key
#[tauri::command]
pub async fn validate_claude_key() -> Result<bool> {
    let api_key = KeychainService::get_claude_key()?
        .ok_or_else(|| crate::error::AppError::ProcessFailed("Claude API key not set".into()))?;

    let service = ClaudeService::new(&api_key);
    service.validate_api_key().await
}

/// Chat with Claude
#[tauri::command]
pub async fn claude_chat(
    model: String,
    messages: Vec<ChatMessageInput>,
    system: Option<String>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
) -> Result<String> {
    let api_key = KeychainService::get_claude_key()?
        .ok_or_else(|| crate::error::AppError::ProcessFailed("Claude API key not set".into()))?;

    let service = ClaudeService::new(&api_key);
    let msgs: Vec<crate::services::claude::ClaudeMessage> = messages
        .into_iter()
        .map(|m| crate::services::claude::ClaudeMessage {
            role: m.role,
            content: m.content,
        })
        .collect();

    service
        .message(&model, msgs, system.as_deref(), temperature, max_tokens.unwrap_or(1024))
        .await
}

/// Summarize text using Claude
#[tauri::command]
pub async fn claude_summarize(text: String, language: String, model: String) -> Result<String> {
    let api_key = KeychainService::get_claude_key()?
        .ok_or_else(|| crate::error::AppError::ProcessFailed("Claude API key not set".into()))?;

    let service = ClaudeService::new(&api_key);
    service.summarize(&model, &text, &language).await
}

/// Get available Claude models (static list)
#[tauri::command]
pub fn get_claude_models() -> Vec<ClaudeModel> {
    ClaudeService::available_models()
}

/// Fetch available Claude models from API (dynamic, sorted by newest)
#[tauri::command]
pub async fn fetch_claude_models() -> Result<Vec<ClaudeModel>> {
    let api_key = KeychainService::get_claude_key()?
        .ok_or_else(|| crate::error::AppError::ProcessFailed("Claude API key not set".into()))?;

    let service = ClaudeService::new(&api_key);
    service.fetch_models().await
}

// ============================================================================
// Shared Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessageInput {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct OpenAITranscriptionResult {
    pub text: String,
    pub language: Option<String>,
    pub duration: Option<f64>,
    pub segments: Option<Vec<TranscriptionSegment>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TranscriptionSegment {
    pub id: u32,
    pub start: f64,
    pub end: f64,
    pub text: String,
}
