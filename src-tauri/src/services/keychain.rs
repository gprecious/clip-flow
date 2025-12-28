use crate::error::{AppError, Result};
use keyring::Entry;

const SERVICE_NAME: &str = "clip-flow";

/// API key types that can be stored securely
#[derive(Debug, Clone, Copy)]
pub enum ApiKeyType {
    OpenAI,
    Claude,
}

impl ApiKeyType {
    fn as_str(&self) -> &'static str {
        match self {
            ApiKeyType::OpenAI => "openai_api_key",
            ApiKeyType::Claude => "claude_api_key",
        }
    }
}

/// Keychain service for secure API key storage
pub struct KeychainService;

impl KeychainService {
    /// Store an API key securely in the system keychain
    pub fn store_api_key(key_type: ApiKeyType, api_key: &str) -> Result<()> {
        let entry = Entry::new(SERVICE_NAME, key_type.as_str())
            .map_err(|e| AppError::ProcessFailed(format!("Failed to create keyring entry: {}", e)))?;

        entry
            .set_password(api_key)
            .map_err(|e| AppError::ProcessFailed(format!("Failed to store API key: {}", e)))?;

        Ok(())
    }

    /// Retrieve an API key from the system keychain
    pub fn get_api_key(key_type: ApiKeyType) -> Result<Option<String>> {
        let entry = Entry::new(SERVICE_NAME, key_type.as_str())
            .map_err(|e| AppError::ProcessFailed(format!("Failed to create keyring entry: {}", e)))?;

        match entry.get_password() {
            Ok(password) => Ok(Some(password)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(AppError::ProcessFailed(format!(
                "Failed to retrieve API key: {}",
                e
            ))),
        }
    }

    /// Delete an API key from the system keychain
    pub fn delete_api_key(key_type: ApiKeyType) -> Result<()> {
        let entry = Entry::new(SERVICE_NAME, key_type.as_str())
            .map_err(|e| AppError::ProcessFailed(format!("Failed to create keyring entry: {}", e)))?;

        match entry.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()), // Already deleted
            Err(e) => Err(AppError::ProcessFailed(format!(
                "Failed to delete API key: {}",
                e
            ))),
        }
    }

    /// Check if an API key is stored
    pub fn has_api_key(key_type: ApiKeyType) -> Result<bool> {
        Ok(Self::get_api_key(key_type)?.is_some())
    }

    /// Store OpenAI API key
    pub fn store_openai_key(api_key: &str) -> Result<()> {
        Self::store_api_key(ApiKeyType::OpenAI, api_key)
    }

    /// Get OpenAI API key
    pub fn get_openai_key() -> Result<Option<String>> {
        Self::get_api_key(ApiKeyType::OpenAI)
    }

    /// Store Claude API key
    pub fn store_claude_key(api_key: &str) -> Result<()> {
        Self::store_api_key(ApiKeyType::Claude, api_key)
    }

    /// Get Claude API key
    pub fn get_claude_key() -> Result<Option<String>> {
        Self::get_api_key(ApiKeyType::Claude)
    }
}
