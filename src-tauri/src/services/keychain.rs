use crate::error::{AppError, Result};
use std::process::Command;

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

/// Keychain service for secure API key storage using macOS security command
pub struct KeychainService;

impl KeychainService {
    /// Store an API key securely in the system keychain using macOS security command
    pub fn store_api_key(key_type: ApiKeyType, api_key: &str) -> Result<()> {
        let account = key_type.as_str();
        println!("[KeychainService::store_api_key] Storing key for service: {}, account: {}", SERVICE_NAME, account);

        // First, try to delete existing entry (ignore errors)
        let _ = Command::new("security")
            .args(["delete-generic-password", "-s", SERVICE_NAME, "-a", account])
            .output();

        // Add new entry
        let output = Command::new("security")
            .args([
                "add-generic-password",
                "-s", SERVICE_NAME,
                "-a", account,
                "-w", api_key,
                "-U", // Update if exists
            ])
            .output()
            .map_err(|e| AppError::ProcessFailed(format!("Failed to run security command: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            println!("[KeychainService::store_api_key] Error: {}", stderr);
            return Err(AppError::ProcessFailed(format!("Failed to store API key: {}", stderr)));
        }

        println!("[KeychainService::store_api_key] Successfully stored key");
        Ok(())
    }

    /// Retrieve an API key from the system keychain using macOS security command
    pub fn get_api_key(key_type: ApiKeyType) -> Result<Option<String>> {
        let account = key_type.as_str();
        println!("[KeychainService::get_api_key] Getting key for service: {}, account: {}", SERVICE_NAME, account);

        let output = Command::new("security")
            .args([
                "find-generic-password",
                "-s", SERVICE_NAME,
                "-a", account,
                "-w", // Output only the password
            ])
            .output()
            .map_err(|e| AppError::ProcessFailed(format!("Failed to run security command: {}", e)))?;

        if !output.status.success() {
            // Check if it's a "not found" error
            let stderr = String::from_utf8_lossy(&output.stderr);
            if stderr.contains("could not be found") || stderr.contains("SecKeychainSearchCopyNext") {
                println!("[KeychainService::get_api_key] No entry found");
                return Ok(None);
            }
            println!("[KeychainService::get_api_key] Error: {}", stderr);
            return Err(AppError::ProcessFailed(format!("Failed to get API key: {}", stderr)));
        }

        let password = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if password.is_empty() {
            println!("[KeychainService::get_api_key] Empty password");
            return Ok(None);
        }

        println!("[KeychainService::get_api_key] Found key, length: {}", password.len());
        Ok(Some(password))
    }

    /// Delete an API key from the system keychain using macOS security command
    pub fn delete_api_key(key_type: ApiKeyType) -> Result<()> {
        let account = key_type.as_str();
        println!("[KeychainService::delete_api_key] Deleting key for service: {}, account: {}", SERVICE_NAME, account);

        let output = Command::new("security")
            .args(["delete-generic-password", "-s", SERVICE_NAME, "-a", account])
            .output()
            .map_err(|e| AppError::ProcessFailed(format!("Failed to run security command: {}", e)))?;

        // Ignore "not found" errors
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if !stderr.contains("could not be found") && !stderr.contains("SecKeychainSearchCopyNext") {
                println!("[KeychainService::delete_api_key] Error: {}", stderr);
                return Err(AppError::ProcessFailed(format!("Failed to delete API key: {}", stderr)));
            }
        }

        println!("[KeychainService::delete_api_key] Successfully deleted key");
        Ok(())
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
