# Rust Test Patterns

## Basic Unit Test

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_function_success() {
        let result = my_function("input");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "expected");
    }

    #[test]
    fn test_function_error() {
        let result = my_function("");
        assert!(result.is_err());
    }

    #[test]
    #[should_panic(expected = "empty input")]
    fn test_panic_on_empty() {
        my_function_that_panics("");
    }
}
```

## Using tempfile for File System Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::io::Write;
    use tempfile::TempDir;

    #[test]
    fn test_scan_directory_with_files() {
        let temp_dir = TempDir::new().unwrap();

        // Create test files
        File::create(temp_dir.path().join("video.mp4")).unwrap();
        File::create(temp_dir.path().join("audio.mp3")).unwrap();
        File::create(temp_dir.path().join("document.pdf")).unwrap();

        let result = scan_directory(temp_dir.path());
        assert!(result.is_ok());

        let files = result.unwrap();
        assert_eq!(files.len(), 2); // Only media files
        assert!(files.iter().any(|f| f.name == "video.mp4"));
        assert!(files.iter().any(|f| f.name == "audio.mp3"));
    }

    #[test]
    fn test_scan_nonexistent_directory() {
        let result = scan_directory(Path::new("/nonexistent/path"));
        assert!(result.is_err());
    }

    #[test]
    fn test_nested_directory_scan() {
        let temp_dir = TempDir::new().unwrap();

        // Create nested structure
        let subdir = temp_dir.path().join("subdir");
        fs::create_dir(&subdir).unwrap();

        File::create(temp_dir.path().join("root.mp4")).unwrap();
        File::create(subdir.join("nested.mp4")).unwrap();

        let result = scan_directory_recursive(temp_dir.path());
        assert!(result.is_ok());

        let files = result.unwrap();
        assert_eq!(files.len(), 2);
    }
}
```

## Testing Async Functions

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_async_function() {
        let result = fetch_data("https://example.com").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_async_with_timeout() {
        let result = tokio::time::timeout(
            std::time::Duration::from_secs(5),
            slow_operation()
        ).await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_concurrent_operations() {
        let (result1, result2) = tokio::join!(
            operation_a(),
            operation_b()
        );

        assert!(result1.is_ok());
        assert!(result2.is_ok());
    }
}
```

## Testing Error Types

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let error = AppError::NotFound("file.txt".to_string());
        assert_eq!(error.to_string(), "Not found: file.txt");
    }

    #[test]
    fn test_error_conversion_from_io() {
        let io_error = std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "File not found"
        );
        let app_error: AppError = io_error.into();

        match app_error {
            AppError::IoError(msg) => assert!(msg.contains("not found")),
            _ => panic!("Expected IoError variant"),
        }
    }

    #[test]
    fn test_error_serialization() {
        let error = AppError::ValidationError("Invalid input".to_string());
        let serialized = serde_json::to_string(&error).unwrap();

        assert!(serialized.contains("ValidationError"));
    }
}
```

## Testing Media File Utilities

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_supported_media_video() {
        assert!(is_supported_media("video.mp4"));
        assert!(is_supported_media("video.mov"));
        assert!(is_supported_media("video.avi"));
        assert!(is_supported_media("video.mkv"));
        assert!(is_supported_media("video.webm"));
    }

    #[test]
    fn test_is_supported_media_audio() {
        assert!(is_supported_media("audio.mp3"));
        assert!(is_supported_media("audio.wav"));
        assert!(is_supported_media("audio.m4a"));
        assert!(is_supported_media("audio.flac"));
    }

    #[test]
    fn test_is_supported_media_unsupported() {
        assert!(!is_supported_media("document.pdf"));
        assert!(!is_supported_media("image.png"));
        assert!(!is_supported_media("text.txt"));
    }

    #[test]
    fn test_is_supported_media_case_insensitive() {
        assert!(is_supported_media("VIDEO.MP4"));
        assert!(is_supported_media("Audio.Mp3"));
    }
}
```

## Testing with Mocks

```rust
#[cfg(test)]
mod tests {
    use super::*;

    // Define a mock trait implementation
    struct MockTranscriber {
        result: String,
        should_fail: bool,
    }

    impl Transcriber for MockTranscriber {
        fn transcribe(&self, _path: &Path) -> Result<String, Error> {
            if self.should_fail {
                Err(Error::new("Transcription failed"))
            } else {
                Ok(self.result.clone())
            }
        }
    }

    #[test]
    fn test_with_mock_success() {
        let mock = MockTranscriber {
            result: "Hello world".to_string(),
            should_fail: false,
        };

        let result = process_with_transcriber(&mock, Path::new("test.mp4"));
        assert_eq!(result.unwrap(), "Processed: Hello world");
    }

    #[test]
    fn test_with_mock_failure() {
        let mock = MockTranscriber {
            result: String::new(),
            should_fail: true,
        };

        let result = process_with_transcriber(&mock, Path::new("test.mp4"));
        assert!(result.is_err());
    }
}
```

## Test Helper Functions

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    // Reusable test fixture
    fn create_test_media_dir() -> (TempDir, Vec<PathBuf>) {
        let dir = TempDir::new().unwrap();
        let files = vec![
            dir.path().join("video1.mp4"),
            dir.path().join("video2.mov"),
            dir.path().join("audio.mp3"),
        ];

        for file in &files {
            std::fs::write(file, b"fake content").unwrap();
        }

        (dir, files)
    }

    #[test]
    fn test_with_fixture() {
        let (temp_dir, files) = create_test_media_dir();

        let result = scan_directory(temp_dir.path());
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), files.len());
    }
}
```

## Testing Tauri Commands

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tauri::test::{mock_context, MockRuntime};

    #[test]
    fn test_tauri_command() {
        let app = tauri::test::mock_builder()
            .invoke_handler(tauri::generate_handler![my_command])
            .build(mock_context(Default::default()))
            .unwrap();

        let result: String = tauri::test::invoke(
            &app,
            "my_command",
            json!({ "arg1": "value1" })
        ).unwrap();

        assert_eq!(result, "expected");
    }
}
```

## Running Rust Tests

```bash
# Run all tests (from src-tauri directory)
cd src-tauri && cargo test

# Run specific test
cargo test test_function_name

# Run tests in specific module
cargo test services::directory_service

# Run with output (show println!)
cargo test -- --nocapture

# Run ignored tests
cargo test -- --ignored

# Run tests in release mode
cargo test --release

# Run with specific number of threads
cargo test -- --test-threads=1

# Show test execution time
cargo test -- --show-output
```

## Test Organization Best Practices

```rust
// src/services/my_service.rs

pub fn my_function() -> Result<String, Error> {
    // Implementation
}

pub fn another_function() -> bool {
    // Implementation
}

#[cfg(test)]
mod tests {
    use super::*;

    // Group related tests
    mod my_function_tests {
        use super::*;

        #[test]
        fn returns_ok_on_valid_input() {
            // ...
        }

        #[test]
        fn returns_err_on_invalid_input() {
            // ...
        }
    }

    mod another_function_tests {
        use super::*;

        #[test]
        fn returns_true_when_condition_met() {
            // ...
        }
    }
}
```

## Integration Tests

For integration tests, create files in `tests/` directory:

```rust
// tests/integration_test.rs

use clip_flow::services::directory_service;
use tempfile::TempDir;

#[test]
fn test_full_directory_scan_workflow() {
    let temp_dir = TempDir::new().unwrap();

    // Setup
    std::fs::write(temp_dir.path().join("video.mp4"), b"content").unwrap();

    // Execute
    let result = directory_service::scan_and_process(temp_dir.path());

    // Assert
    assert!(result.is_ok());
}
```
