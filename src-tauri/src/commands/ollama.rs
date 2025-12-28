use crate::error::Result;
use crate::services::{ChatMessage, OllamaModel, OllamaService, StorySegment, TranscriptionSegment};

/// Check if Ollama is running
#[tauri::command]
pub async fn check_ollama() -> Result<bool> {
    let service = OllamaService::new();
    Ok(service.is_available().await)
}

/// Get list of Ollama models
#[tauri::command]
pub async fn list_ollama_models() -> Result<Vec<OllamaModel>> {
    let service = OllamaService::new();
    service.list_models().await
}

/// Generate text with Ollama
#[tauri::command]
pub async fn ollama_generate(model: String, prompt: String) -> Result<String> {
    let service = OllamaService::new();
    service.generate(&model, &prompt).await
}

/// Chat with Ollama
#[tauri::command]
pub async fn ollama_chat(model: String, messages: Vec<ChatMessage>) -> Result<String> {
    let service = OllamaService::new();
    service.chat(&model, messages).await
}

/// Summarize text using Ollama
#[tauri::command]
pub async fn summarize_text(model: String, text: String, language: String) -> Result<String> {
    let service = OllamaService::new();
    service.summarize(&model, &text, &language).await
}

/// Extract story order from transcription segments
#[tauri::command]
pub async fn extract_story_order(
    model: String,
    segments: Vec<TranscriptionSegment>,
) -> Result<Vec<StorySegment>> {
    let service = OllamaService::new();
    service.extract_story_order(&model, &segments).await
}

/// Pull/download an Ollama model
#[tauri::command]
pub async fn pull_ollama_model(model_name: String) -> Result<()> {
    let service = OllamaService::new();
    service.pull_model(&model_name).await
}

/// Delete an Ollama model
#[tauri::command]
pub async fn delete_ollama_model(model_name: String) -> Result<()> {
    let service = OllamaService::new();
    service.delete_model(&model_name).await
}
