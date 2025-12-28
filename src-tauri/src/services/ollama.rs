use crate::error::{AppError, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};

const OLLAMA_BASE_URL: &str = "http://localhost:11434";

/// Ollama service for local LLM integration
pub struct OllamaService {
    client: Client,
    base_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaModel {
    pub name: String,
    pub size: u64,
    pub modified_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaModelsResponse {
    pub models: Vec<OllamaModel>,
}

#[derive(Debug, Clone, Serialize)]
struct GenerateRequest {
    model: String,
    prompt: String,
    stream: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
struct GenerateResponse {
    response: String,
    done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    stream: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
struct ChatResponse {
    message: ChatMessage,
    done: bool,
}

impl OllamaService {
    /// Create a new Ollama service
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            base_url: OLLAMA_BASE_URL.to_string(),
        }
    }

    /// Check if Ollama is running
    pub async fn is_available(&self) -> bool {
        let url = format!("{}/api/tags", self.base_url);
        self.client.get(&url).send().await.is_ok()
    }

    /// Get list of available models
    pub async fn list_models(&self) -> Result<Vec<OllamaModel>> {
        let url = format!("{}/api/tags", self.base_url);

        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::Network(e))?;

        if response.status().is_success() {
            let models_response: OllamaModelsResponse = response.json().await?;
            Ok(models_response.models)
        } else {
            Err(AppError::Whisper("Failed to list Ollama models".to_string()))
        }
    }

    /// Generate text completion (non-streaming)
    pub async fn generate(&self, model: &str, prompt: &str) -> Result<String> {
        let url = format!("{}/api/generate", self.base_url);

        let request = GenerateRequest {
            model: model.to_string(),
            prompt: prompt.to_string(),
            stream: false,
        };

        let response = self.client
            .post(&url)
            .json(&request)
            .send()
            .await?;

        if response.status().is_success() {
            let generate_response: GenerateResponse = response.json().await?;
            Ok(generate_response.response)
        } else {
            Err(AppError::Whisper(format!("Ollama generate failed: {}", response.status())))
        }
    }

    /// Chat completion (non-streaming)
    pub async fn chat(&self, model: &str, messages: Vec<ChatMessage>) -> Result<String> {
        let url = format!("{}/api/chat", self.base_url);

        let request = ChatRequest {
            model: model.to_string(),
            messages,
            stream: false,
        };

        let response = self.client
            .post(&url)
            .json(&request)
            .send()
            .await?;

        if response.status().is_success() {
            let chat_response: ChatResponse = response.json().await?;
            Ok(chat_response.message.content)
        } else {
            Err(AppError::Whisper(format!("Ollama chat failed: {}", response.status())))
        }
    }

    /// Summarize text using Ollama
    pub async fn summarize(&self, model: &str, text: &str, language: &str) -> Result<String> {
        let prompt = format!(
            "Please summarize the following transcription in {}. \
             Provide a concise summary that captures the main points and key information.\n\n\
             Transcription:\n{}\n\nSummary:",
            language, text
        );

        self.generate(model, &prompt).await
    }

    /// Extract story order / timeline from transcription
    pub async fn extract_story_order(
        &self,
        model: &str,
        segments: &[super::whisper::TranscriptionSegment],
    ) -> Result<Vec<StorySegment>> {
        let segments_text: Vec<String> = segments.iter().enumerate().map(|(i, s)| {
            format!("[{}] ({:.1}s - {:.1}s): {}", i, s.start, s.end, s.text)
        }).collect();

        let prompt = format!(
            "Analyze these transcription segments and suggest the best story order. \
             Return a JSON array of segment indices in the recommended order, \
             with a brief reason for each segment's position.\n\n\
             Segments:\n{}\n\n\
             Response format: [{{\"index\": 0, \"reason\": \"Opening statement\"}}, ...]\n\nJSON:",
            segments_text.join("\n")
        );

        let response = self.generate(model, &prompt).await?;

        // Parse JSON response
        let story_segments: Vec<StorySegment> = serde_json::from_str(&response)
            .map_err(|_| AppError::Whisper("Failed to parse story order response".to_string()))?;

        Ok(story_segments)
    }

    /// Pull/download a model
    pub async fn pull_model(&self, model_name: &str) -> Result<()> {
        let url = format!("{}/api/pull", self.base_url);

        let response = self.client
            .post(&url)
            .json(&serde_json::json!({ "name": model_name }))
            .send()
            .await?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(AppError::Download(format!("Failed to pull model: {}", model_name)))
        }
    }

    /// Delete a model
    pub async fn delete_model(&self, model_name: &str) -> Result<()> {
        let url = format!("{}/api/delete", self.base_url);

        let response = self.client
            .delete(&url)
            .json(&serde_json::json!({ "name": model_name }))
            .send()
            .await?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(AppError::Download(format!("Failed to delete model: {}", model_name)))
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorySegment {
    pub index: usize,
    pub reason: String,
}
