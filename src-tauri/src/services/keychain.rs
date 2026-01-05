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

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper to store API key with test-specific account name
    fn store_test_key(account: &str, key: &str) -> Result<()> {
        let entry = Entry::new(SERVICE_NAME, account)
            .map_err(|e| AppError::Keychain(format!("Failed to create entry: {}", e)))?;
        entry
            .set_password(key)
            .map_err(|e| AppError::Keychain(format!("Failed to store key: {}", e)))?;
        Ok(())
    }

    /// Helper to get API key with test-specific account name
    fn get_test_key(account: &str) -> Result<Option<String>> {
        let entry = Entry::new(SERVICE_NAME, account)
            .map_err(|e| AppError::Keychain(format!("Failed to create entry: {}", e)))?;
        match entry.get_password() {
            Ok(key) => Ok(Some(key)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(AppError::Keychain(format!("Failed to get key: {}", e))),
        }
    }

    /// Helper to delete test key
    fn delete_test_key(account: &str) -> Result<()> {
        let entry = Entry::new(SERVICE_NAME, account)
            .map_err(|e| AppError::Keychain(format!("Failed to create entry: {}", e)))?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(AppError::Keychain(format!("Failed to delete key: {}", e))),
        }
    }

    // NOTE: These tests require a real system keychain (macOS Keychain, Windows Credential Manager, etc.)
    // They are ignored by default to avoid CI failures. Run with `cargo test -- --ignored` locally.

    #[test]
    #[ignore = "requires real system keychain - run locally with `cargo test -- --ignored`"]
    fn test_store_and_retrieve_key() {
        let account = "test_store_retrieve";
        let test_key = "sk-test-key-12345";

        // Cleanup first
        let _ = delete_test_key(account);

        // Store and retrieve
        store_test_key(account, test_key).unwrap();
        let retrieved = get_test_key(account).unwrap();
        assert_eq!(retrieved, Some(test_key.to_string()));

        // Cleanup
        delete_test_key(account).unwrap();
    }

    #[test]
    #[ignore = "requires real system keychain - run locally with `cargo test -- --ignored`"]
    fn test_key_persists_across_entry_instances() {
        let account = "test_persistence";
        let test_key = "sk-persistence-test";

        // Cleanup first
        let _ = delete_test_key(account);

        // Store with one entry instance
        {
            let entry = Entry::new(SERVICE_NAME, account).unwrap();
            entry.set_password(test_key).unwrap();
        }

        // Retrieve with new entry instance (simulates app restart)
        {
            let entry = Entry::new(SERVICE_NAME, account).unwrap();
            let retrieved = entry.get_password().unwrap();
            assert_eq!(retrieved, test_key);
        }

        // Cleanup
        delete_test_key(account).unwrap();
    }

    #[test]
    #[ignore = "requires real system keychain - run locally with `cargo test -- --ignored`"]
    fn test_delete_nonexistent_key() {
        let account = "test_delete_nonexistent";

        // Ensure no key exists
        let _ = delete_test_key(account);

        // Deleting again should not error (idempotent)
        let result = delete_test_key(account);
        assert!(result.is_ok());
    }

    #[test]
    #[ignore = "requires real system keychain - run locally with `cargo test -- --ignored`"]
    fn test_has_key() {
        let account = "test_has_key";

        // Cleanup first
        let _ = delete_test_key(account);

        // Initially should not have key
        let has_key = get_test_key(account).unwrap().is_some();
        assert!(!has_key);

        // Store a key
        store_test_key(account, "test-key").unwrap();
        let has_key = get_test_key(account).unwrap().is_some();
        assert!(has_key);

        // Cleanup
        delete_test_key(account).unwrap();
        let has_key = get_test_key(account).unwrap().is_some();
        assert!(!has_key);
    }

    #[test]
    #[ignore = "requires real system keychain - run locally with `cargo test -- --ignored`"]
    fn test_get_nonexistent_key() {
        let account = "test_get_nonexistent";

        // Cleanup first
        let _ = delete_test_key(account);

        // Getting non-existent key should return None
        let result = get_test_key(account).unwrap();
        assert_eq!(result, None);
    }

    #[test]
    #[ignore = "requires real system keychain - run locally with `cargo test -- --ignored`"]
    fn test_overwrite_existing_key() {
        let account = "test_overwrite";
        let key1 = "sk-first-key";
        let key2 = "sk-second-key";

        // Cleanup first
        let _ = delete_test_key(account);

        // Store first key
        store_test_key(account, key1).unwrap();
        assert_eq!(get_test_key(account).unwrap(), Some(key1.to_string()));

        // Overwrite with second key
        store_test_key(account, key2).unwrap();
        assert_eq!(get_test_key(account).unwrap(), Some(key2.to_string()));

        // Cleanup
        delete_test_key(account).unwrap();
    }
}
