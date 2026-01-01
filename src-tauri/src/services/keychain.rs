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

/// Keychain service for secure API key storage using keyring crate
/// Supports Windows (Credential Manager), macOS (Keychain), and Linux (Secret Service)
pub struct KeychainService;

impl KeychainService {
    /// Store an API key securely in the system keychain
    pub fn store_api_key(key_type: ApiKeyType, api_key: &str) -> Result<()> {
        let account = key_type.as_str();
        println!(
            "[KeychainService::store_api_key] Storing key for service: {}, account: {}",
            SERVICE_NAME, account
        );

        let entry = Entry::new(SERVICE_NAME, account)
            .map_err(|e| AppError::Keychain(format!("Failed to create keyring entry: {}", e)))?;

        entry
            .set_password(api_key)
            .map_err(|e| AppError::Keychain(format!("Failed to store API key: {}", e)))?;

        println!("[KeychainService::store_api_key] Successfully stored key");
        Ok(())
    }

    /// Retrieve an API key from the system keychain
    pub fn get_api_key(key_type: ApiKeyType) -> Result<Option<String>> {
        let account = key_type.as_str();
        println!(
            "[KeychainService::get_api_key] Getting key for service: {}, account: {}",
            SERVICE_NAME, account
        );

        let entry = Entry::new(SERVICE_NAME, account)
            .map_err(|e| AppError::Keychain(format!("Failed to create keyring entry: {}", e)))?;

        match entry.get_password() {
            Ok(password) => {
                if password.is_empty() {
                    println!("[KeychainService::get_api_key] Empty password");
                    return Ok(None);
                }
                println!(
                    "[KeychainService::get_api_key] Found key, length: {}",
                    password.len()
                );
                Ok(Some(password))
            }
            Err(keyring::Error::NoEntry) => {
                println!("[KeychainService::get_api_key] No entry found");
                Ok(None)
            }
            Err(e) => Err(AppError::Keychain(format!("Failed to get API key: {}", e))),
        }
    }

    /// Delete an API key from the system keychain
    pub fn delete_api_key(key_type: ApiKeyType) -> Result<()> {
        let account = key_type.as_str();
        println!(
            "[KeychainService::delete_api_key] Deleting key for service: {}, account: {}",
            SERVICE_NAME, account
        );

        let entry = Entry::new(SERVICE_NAME, account)
            .map_err(|e| AppError::Keychain(format!("Failed to create keyring entry: {}", e)))?;

        match entry.delete_credential() {
            Ok(()) => {
                println!("[KeychainService::delete_api_key] Successfully deleted key");
                Ok(())
            }
            Err(keyring::Error::NoEntry) => {
                // Ignore "not found" errors - key is already deleted
                println!("[KeychainService::delete_api_key] No entry found (already deleted)");
                Ok(())
            }
            Err(e) => Err(AppError::Keychain(format!(
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
