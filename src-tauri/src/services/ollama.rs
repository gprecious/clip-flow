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
        } else if response.status() == reqwest::StatusCode::NOT_FOUND {
            Err(AppError::Whisper(format!(
                "Model '{}' not found. Please install it by running: ollama pull {}",
                model, model
            )))
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
        } else if response.status() == reqwest::StatusCode::NOT_FOUND {
            Err(AppError::Whisper(format!(
                "Model '{}' not found. Please install it by running: ollama pull {}",
                model, model
            )))
        } else {
            Err(AppError::Whisper(format!("Ollama chat failed: {}", response.status())))
        }
    }

    /// Summarize text using Ollama
    pub async fn summarize(&self, model: &str, text: &str, language: &str) -> Result<String> {
        let lang_instruction = language_code_to_name(language);

        let prompt = format!(
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
             Start directly with the summary content.\n\n\
             Transcription:\n{}\n\nSummary:",
            lang_instruction, text
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
    /// This streams the response and waits for the download to complete
    pub async fn pull_model(&self, model_name: &str) -> Result<()> {
        let url = format!("{}/api/pull", self.base_url);

        let response = self.client
            .post(&url)
            .json(&serde_json::json!({ "name": model_name, "stream": true }))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::Download(format!("Failed to pull model: {}", model_name)));
        }

        // Stream the response and wait for completion
        // Ollama sends newline-delimited JSON with progress updates
        use futures::StreamExt;
        let mut stream = response.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| AppError::Network(e))?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            // Process complete lines
            while let Some(newline_pos) = buffer.find('\n') {
                let line = buffer[..newline_pos].to_string();
                buffer = buffer[newline_pos + 1..].to_string();

                if line.trim().is_empty() {
                    continue;
                }

                // Parse the JSON response
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                    // Check for error
                    if let Some(error) = json.get("error").and_then(|e| e.as_str()) {
                        return Err(AppError::Download(format!("Failed to pull model: {}", error)));
                    }

                    // Check for completion status
                    if let Some(status) = json.get("status").and_then(|s| s.as_str()) {
                        if status == "success" {
                            return Ok(());
                        }
                    }
                }
            }
        }

        Ok(())
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
        _ => code.to_string(), // Return as-is if unknown
    }
}
