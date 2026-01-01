use crate::error::{AppError, Result};
use crate::services::download::DownloadService;
use futures::StreamExt;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::fs::{self, File};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;

/// Whisper transcription service
pub struct WhisperService {
    whisper_cpp_path: Option<PathBuf>,
    download_service: DownloadService,
}

/// Transcription segment with timestamp
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TranscriptionSegment {
    pub start: f64,
    pub end: f64,
    pub text: String,
}

/// Full transcription result
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TranscriptionResult {
    pub segments: Vec<TranscriptionSegment>,
    pub full_text: String,
    pub language: Option<String>,
    pub duration: f64,
}

impl WhisperService {
    /// Create a new Whisper service
    pub fn new() -> Result<Self> {
        let download_service = DownloadService::new()?;

        // Try to find whisper.cpp binary
        let whisper_cpp_path = Self::find_whisper_cpp();

        Ok(Self {
            whisper_cpp_path,
            download_service,
        })
    }

    /// Find whisper.cpp binary in common locations
    fn find_whisper_cpp() -> Option<PathBuf> {
        // Platform-specific binary name
        #[cfg(target_os = "windows")]
        let binary_name = "whisper-cpp.exe";
        #[cfg(not(target_os = "windows"))]
        let binary_name = "whisper-cpp";

        #[cfg(target_os = "windows")]
        let cli_name = "whisper-cli.exe";
        #[cfg(not(target_os = "windows"))]
        let cli_name = "whisper-cli";

        let mut possible_paths: Vec<Option<PathBuf>> = vec![
            // In app bundle (next to executable)
            std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|p| p.join(binary_name))),
            // In data directory
            dirs::data_local_dir()
                .map(|p| p.join("clip-flow").join("bin").join(binary_name)),
        ];

        // Windows-specific paths
        #[cfg(target_os = "windows")]
        {
            // Program Files
            if let Ok(program_files) = std::env::var("PROGRAMFILES") {
                possible_paths.push(Some(PathBuf::from(&program_files).join("whisper-cpp").join(cli_name)));
                possible_paths.push(Some(PathBuf::from(&program_files).join("whisper-cpp").join(binary_name)));
            }
            // Local AppData (user installation)
            if let Some(local_app_data) = dirs::data_local_dir() {
                possible_paths.push(Some(local_app_data.join("whisper-cpp").join(cli_name)));
                possible_paths.push(Some(local_app_data.join("whisper-cpp").join(binary_name)));
            }
        }

        // macOS-specific paths (Homebrew)
        #[cfg(target_os = "macos")]
        {
            // Homebrew whisper-cli on Apple Silicon (primary)
            possible_paths.push(Some(PathBuf::from("/opt/homebrew/bin/whisper-cli")));
            // Homebrew whisper-cli on Intel Mac
            possible_paths.push(Some(PathBuf::from("/usr/local/bin/whisper-cli")));
            // Legacy: whisper-cpp name (older versions)
            possible_paths.push(Some(PathBuf::from("/opt/homebrew/bin/whisper-cpp")));
            possible_paths.push(Some(PathBuf::from("/usr/local/bin/whisper-cpp")));
        }

        // Common: In PATH (works on all platforms)
        possible_paths.push(which::which(cli_name).ok());
        possible_paths.push(which::which(binary_name).ok());
        // whisper.cpp default binary name when built from source
        possible_paths.push(which::which("main").ok());

        for path in possible_paths.into_iter().flatten() {
            if path.exists() {
                log::info!("[whisper.rs] Found whisper.cpp at: {:?}", path);
                return Some(path);
            }
        }

        log::info!("[whisper.rs] whisper.cpp not found in any known location");
        None
    }

    /// Check if Whisper.cpp is available
    pub fn is_available(&self) -> bool {
        self.whisper_cpp_path.is_some()
    }

    /// Transcribe an audio file using whisper.cpp
    pub async fn transcribe<F>(
        &self,
        audio_path: &Path,
        model_id: &str,
        language: Option<&str>,
        on_progress: F,
    ) -> Result<TranscriptionResult>
    where
        F: Fn(f32) + Send + 'static,
    {
        let whisper_path = self.whisper_cpp_path.as_ref()
            .ok_or_else(|| AppError::Whisper("whisper.cpp not found".to_string()))?;

        // Check if model is installed
        if !self.download_service.is_model_installed(model_id).await? {
            return Err(AppError::ModelNotFound(format!("Model '{}' is not installed", model_id)));
        }

        let model_path = self.download_service.get_model_path(model_id);
        let output_path = audio_path.with_extension("json");

        // Build whisper.cpp command
        let mut cmd = Command::new(whisper_path);
        cmd.args([
            "-m", model_path.to_str().unwrap(),
            "-f", audio_path.to_str().unwrap(),
            "-oj",  // Output JSON
            "-of", output_path.to_str().unwrap().trim_end_matches(".json"),
            "-pp", // Print progress
        ]);

        // Add language if specified
        if let Some(lang) = language {
            cmd.args(["-l", lang]);
        }

        let mut child = cmd
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| AppError::Whisper(format!("Failed to start whisper: {}", e)))?;

        // Read progress from stderr
        if let Some(stderr) = child.stderr.take() {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                // whisper.cpp outputs progress like "progress = 50%"
                if line.contains("progress") {
                    if let Some(percent_str) = line.split('=').nth(1) {
                        if let Ok(percent) = percent_str.trim().trim_end_matches('%').parse::<f32>() {
                            on_progress(percent);
                        }
                    }
                }
            }
        }

        let status = child.wait().await
            .map_err(|e| AppError::Whisper(format!("Whisper process error: {}", e)))?;

        if !status.success() {
            return Err(AppError::Whisper("Transcription failed".to_string()));
        }

        on_progress(100.0);

        // Parse output JSON
        self.parse_whisper_output(&output_path).await
    }

    /// Parse whisper.cpp JSON output
    async fn parse_whisper_output(&self, json_path: &Path) -> Result<TranscriptionResult> {
        let content = tokio::fs::read_to_string(json_path).await?;
        log::info!("[whisper.rs] Parsing JSON output from: {:?}", json_path);

        let json: serde_json::Value = serde_json::from_str(&content)?;

        let mut segments = Vec::new();
        let mut full_text = String::new();

        if let Some(transcription) = json.get("transcription").and_then(|t| t.as_array()) {
            log::info!("[whisper.rs] Found {} transcription segments", transcription.len());

            for segment in transcription {
                // Try timestamps first (formatted strings like "00:01:23,456")
                let start = segment.get("timestamps")
                    .and_then(|t| t.get("from"))
                    .and_then(|f| f.as_str())
                    .and_then(|s| Self::parse_timestamp(s))
                    // Fallback to offsets (milliseconds as integers)
                    .or_else(|| {
                        segment.get("offsets")
                            .and_then(|o| o.get("from"))
                            .and_then(|f| f.as_i64())
                            .map(|ms| ms as f64 / 1000.0)
                    })
                    .unwrap_or(0.0);

                let end = segment.get("timestamps")
                    .and_then(|t| t.get("to"))
                    .and_then(|f| f.as_str())
                    .and_then(|s| Self::parse_timestamp(s))
                    // Fallback to offsets (milliseconds as integers)
                    .or_else(|| {
                        segment.get("offsets")
                            .and_then(|o| o.get("to"))
                            .and_then(|f| f.as_i64())
                            .map(|ms| ms as f64 / 1000.0)
                    })
                    .unwrap_or(0.0);

                let text = segment.get("text")
                    .and_then(|t| t.as_str())
                    .unwrap_or("")
                    .trim()
                    .to_string();

                if !text.is_empty() {
                    full_text.push_str(&text);
                    full_text.push(' ');

                    segments.push(TranscriptionSegment { start, end, text });
                }
            }
        } else {
            log::warn!("[whisper.rs] No 'transcription' field found in JSON");
        }

        let language = json.get("result")
            .and_then(|r| r.get("language"))
            .and_then(|l| l.as_str())
            .map(|s| s.to_string());

        let duration = segments.last().map(|s| s.end).unwrap_or(0.0);
        log::info!("[whisper.rs] Parsed {} segments, duration: {:.2}s", segments.len(), duration);

        // Clean up temp JSON file
        let _ = tokio::fs::remove_file(json_path).await;

        Ok(TranscriptionResult {
            segments,
            full_text: full_text.trim().to_string(),
            language,
            duration,
        })
    }

    /// Parse timestamp string like "00:01:23.456" or "00:01:23,456" to seconds
    fn parse_timestamp(s: &str) -> Option<f64> {
        let parts: Vec<&str> = s.split(':').collect();
        if parts.len() == 3 {
            let hours: f64 = parts[0].parse().ok()?;
            let minutes: f64 = parts[1].parse().ok()?;
            // Handle both period and comma as decimal separator
            let seconds_str = parts[2].replace(',', ".");
            let seconds: f64 = seconds_str.parse().ok()?;
            Some(hours * 3600.0 + minutes * 60.0 + seconds)
        } else {
            None
        }
    }

    /// Get the bin directory path for whisper.cpp installation
    pub fn get_bin_directory() -> Result<PathBuf> {
        let data_dir = dirs::data_local_dir()
            .ok_or_else(|| AppError::InvalidPath("Cannot find data directory".to_string()))?;
        Ok(data_dir.join("clip-flow").join("bin"))
    }

    /// Install whisper.cpp binary
    pub async fn install_whisper_cpp<F>(on_progress: F) -> Result<PathBuf>
    where
        F: Fn(f32, String) + Send + 'static,
    {
        log::info!("[whisper.rs] install_whisper_cpp called");

        // Get download URL for current platform
        let (url, binary_name) = match Self::get_whisper_download_url() {
            Ok(result) => {
                log::info!("[whisper.rs] Download URL: {}, binary_name: {}", result.0, result.1);
                result
            }
            Err(e) => {
                log::error!("[whisper.rs] get_whisper_download_url failed: {:?}", e);
                return Err(e);
            }
        };

        on_progress(0.0, "Preparing download...".to_string());

        // Create bin directory
        let bin_dir = match Self::get_bin_directory() {
            Ok(dir) => {
                log::info!("[whisper.rs] Bin directory: {:?}", dir);
                dir
            }
            Err(e) => {
                log::error!("[whisper.rs] get_bin_directory failed: {:?}", e);
                return Err(e);
            }
        };

        if let Err(e) = fs::create_dir_all(&bin_dir).await {
            log::error!("[whisper.rs] Failed to create bin directory: {:?}", e);
            return Err(e.into());
        }
        log::info!("[whisper.rs] Bin directory created/verified");

        let client = reqwest::Client::new();

        // Download the zip file
        on_progress(5.0, "Downloading whisper.cpp...".to_string());
        log::info!("[whisper.rs] Starting download from: {}", url);

        let response = match client.get(&url).send().await {
            Ok(resp) => {
                log::info!("[whisper.rs] Response received, status: {}", resp.status());
                resp
            }
            Err(e) => {
                log::error!("[whisper.rs] Failed to send request: {:?}", e);
                return Err(AppError::Download(format!("Failed to download whisper.cpp: {}", e)));
            }
        };

        if !response.status().is_success() {
            log::error!("[whisper.rs] HTTP error: {}", response.status());
            return Err(AppError::Download(format!(
                "Failed to download whisper.cpp: HTTP {}",
                response.status()
            )));
        }

        let total_size = response.content_length().unwrap_or(50_000_000);
        log::info!("[whisper.rs] Content-Length: {} bytes", total_size);
        let mut downloaded: u64 = 0;

        let zip_path = bin_dir.join("whisper-cpp.zip");
        log::info!("[whisper.rs] Zip path: {:?}", zip_path);

        let mut file = match File::create(&zip_path).await {
            Ok(f) => f,
            Err(e) => {
                log::error!("[whisper.rs] Failed to create zip file: {:?}", e);
                return Err(e.into());
            }
        };

        let mut stream = response.bytes_stream();

        while let Some(chunk) = stream.next().await {
            let chunk = match chunk {
                Ok(c) => c,
                Err(e) => {
                    log::error!("[whisper.rs] Download stream error: {:?}", e);
                    return Err(AppError::Download(e.to_string()));
                }
            };

            if let Err(e) = file.write_all(&chunk).await {
                log::error!("[whisper.rs] Failed to write chunk: {:?}", e);
                return Err(e.into());
            }

            downloaded += chunk.len() as u64;
            let progress = 5.0 + (downloaded as f32 / total_size as f32 * 70.0);
            on_progress(progress, "Downloading whisper.cpp...".to_string());
        }

        if let Err(e) = file.flush().await {
            log::error!("[whisper.rs] Failed to flush file: {:?}", e);
            return Err(e.into());
        }
        drop(file);

        log::info!("[whisper.rs] Download complete, downloaded {} bytes", downloaded);

        on_progress(75.0, "Extracting whisper.cpp...".to_string());

        // Extract the zip file
        let zip_path_clone = zip_path.clone();
        let bin_dir_clone = bin_dir.clone();
        let binary_name_owned = binary_name.to_string();

        log::info!("[whisper.rs] Starting extraction, looking for binary: {}", binary_name_owned);

        let extracted_binary = tokio::task::spawn_blocking(move || {
            log::info!("[whisper.rs] Opening zip file: {:?}", zip_path_clone);
            let file = std::fs::File::open(&zip_path_clone)?;
            let mut archive = zip::ZipArchive::new(file)?;

            log::info!("[whisper.rs] Archive has {} files", archive.len());

            let mut extracted_path = None;

            for i in 0..archive.len() {
                let mut file = archive.by_index(i)?;
                let file_name = file.name().to_string();
                log::info!("[whisper.rs] Archive entry {}: {}", i, file_name);

                // Look for the binary file - more specific matching
                let is_target = file_name.ends_with(&binary_name_owned)
                    || (file_name.contains("whisper-cli") && !file_name.ends_with('/'));

                if is_target {
                    log::info!("[whisper.rs] Found target binary: {}", file_name);

                    #[cfg(target_os = "windows")]
                    let target_name = "whisper-cpp.exe";
                    #[cfg(not(target_os = "windows"))]
                    let target_name = "whisper-cpp";

                    let target_path = bin_dir_clone.join(target_name);
                    log::info!("[whisper.rs] Extracting to: {:?}", target_path);

                    let mut outfile = std::fs::File::create(&target_path)?;
                    let bytes_copied = std::io::copy(&mut file, &mut outfile)?;
                    log::info!("[whisper.rs] Extracted {} bytes", bytes_copied);

                    // Make executable on Unix
                    #[cfg(unix)]
                    {
                        use std::os::unix::fs::PermissionsExt;
                        let mut perms = std::fs::metadata(&target_path)?.permissions();
                        perms.set_mode(0o755);
                        std::fs::set_permissions(&target_path, perms)?;
                        log::info!("[whisper.rs] Set executable permissions");
                    }

                    extracted_path = Some(target_path);
                    break;
                }
            }

            if extracted_path.is_none() {
                log::error!("[whisper.rs] Binary not found in archive!");
            }

            extracted_path.ok_or_else(|| {
                std::io::Error::new(std::io::ErrorKind::NotFound, "Binary not found in archive")
            })
        }).await
        .map_err(|e| {
            log::error!("[whisper.rs] spawn_blocking failed: {:?}", e);
            AppError::Whisper(format!("Extract task failed: {}", e))
        })?
        .map_err(|e: std::io::Error| {
            log::error!("[whisper.rs] Extraction IO error: {:?}", e);
            AppError::Whisper(format!("Failed to extract: {}", e))
        })?;

        on_progress(95.0, "Cleaning up...".to_string());

        // Clean up zip file
        let _ = fs::remove_file(&zip_path).await;
        log::info!("[whisper.rs] Cleaned up zip file");

        on_progress(100.0, "Installation complete!".to_string());
        log::info!("[whisper.rs] Installation complete: {:?}", extracted_binary);

        Ok(extracted_binary)
    }

    /// Get download URL for current platform
    fn get_whisper_download_url() -> Result<(String, &'static str)> {
        // Note: whisper.cpp releases only have Windows binaries and XCFramework for iOS/macOS
        // macOS requires building from source or using Homebrew

        #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
        {
            const VERSION: &str = "v1.8.2";
            Ok((
                format!("https://github.com/ggml-org/whisper.cpp/releases/download/{}/whisper-bin-x64.zip", VERSION),
                "whisper-cli.exe"
            ))
        }

        #[cfg(all(target_os = "windows", target_arch = "x86"))]
        {
            const VERSION: &str = "v1.8.2";
            Ok((
                format!("https://github.com/ggml-org/whisper.cpp/releases/download/{}/whisper-bin-Win32.zip", VERSION),
                "whisper-cli.exe"
            ))
        }

        #[cfg(target_os = "macos")]
        {
            Err(AppError::Whisper(
                "macOS requires manual installation. Please install via Homebrew: brew install whisper-cpp".to_string()
            ))
        }

        #[cfg(not(any(
            all(target_os = "windows", target_arch = "x86_64"),
            all(target_os = "windows", target_arch = "x86"),
            target_os = "macos"
        )))]
        {
            Err(AppError::Whisper("Unsupported platform for whisper.cpp installation".to_string()))
        }
    }
}
