use crate::error::{AppError, Result};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

/// Find FFmpeg binary path, checking common installation locations
fn find_ffmpeg_path() -> PathBuf {
    let binary_name = if cfg!(target_os = "windows") { "ffmpeg.exe" } else { "ffmpeg" };
    
    let mut possible_paths: Vec<PathBuf> = Vec::new();
    
    // macOS: Homebrew paths
    #[cfg(target_os = "macos")]
    {
        possible_paths.push(PathBuf::from("/opt/homebrew/bin/ffmpeg")); // Apple Silicon
        possible_paths.push(PathBuf::from("/usr/local/bin/ffmpeg"));    // Intel Mac
    }
    
    // Windows: Common installation paths
    #[cfg(target_os = "windows")]
    {
        if let Ok(program_files) = std::env::var("PROGRAMFILES") {
            possible_paths.push(PathBuf::from(&program_files).join("ffmpeg").join("bin").join("ffmpeg.exe"));
        }
        if let Some(local_app_data) = dirs::data_local_dir() {
            possible_paths.push(local_app_data.join("ffmpeg").join("bin").join("ffmpeg.exe"));
        }
    }
    
    // Linux: Standard paths
    #[cfg(target_os = "linux")]
    {
        possible_paths.push(PathBuf::from("/usr/bin/ffmpeg"));
        possible_paths.push(PathBuf::from("/usr/local/bin/ffmpeg"));
    }
    
    // Check each path
    for path in possible_paths {
        if path.exists() {
            log::info!("[ffmpeg.rs] Found ffmpeg at: {:?}", path);
            return path;
        }
    }
    
    // Fallback: Try PATH (works in dev mode)
    if let Ok(path) = which::which(binary_name) {
        log::info!("[ffmpeg.rs] Found ffmpeg in PATH: {:?}", path);
        return path;
    }
    
    // Last resort: return binary name and hope it's in PATH
    log::warn!("[ffmpeg.rs] ffmpeg not found, using default: {}", binary_name);
    PathBuf::from(binary_name)
}

/// Find FFprobe binary path, checking common installation locations
fn find_ffprobe_path() -> PathBuf {
    let binary_name = if cfg!(target_os = "windows") { "ffprobe.exe" } else { "ffprobe" };
    
    let mut possible_paths: Vec<PathBuf> = Vec::new();
    
    // macOS: Homebrew paths
    #[cfg(target_os = "macos")]
    {
        possible_paths.push(PathBuf::from("/opt/homebrew/bin/ffprobe")); // Apple Silicon
        possible_paths.push(PathBuf::from("/usr/local/bin/ffprobe"));    // Intel Mac
    }
    
    // Windows: Common installation paths
    #[cfg(target_os = "windows")]
    {
        if let Ok(program_files) = std::env::var("PROGRAMFILES") {
            possible_paths.push(PathBuf::from(&program_files).join("ffmpeg").join("bin").join("ffprobe.exe"));
        }
        if let Some(local_app_data) = dirs::data_local_dir() {
            possible_paths.push(local_app_data.join("ffmpeg").join("bin").join("ffprobe.exe"));
        }
    }
    
    // Linux: Standard paths
    #[cfg(target_os = "linux")]
    {
        possible_paths.push(PathBuf::from("/usr/bin/ffprobe"));
        possible_paths.push(PathBuf::from("/usr/local/bin/ffprobe"));
    }
    
    // Check each path
    for path in possible_paths {
        if path.exists() {
            log::info!("[ffmpeg.rs] Found ffprobe at: {:?}", path);
            return path;
        }
    }
    
    // Fallback: Try PATH (works in dev mode)
    if let Ok(path) = which::which(binary_name) {
        log::info!("[ffmpeg.rs] Found ffprobe in PATH: {:?}", path);
        return path;
    }
    
    // Last resort: return binary name and hope it's in PATH
    log::warn!("[ffmpeg.rs] ffprobe not found, using default: {}", binary_name);
    PathBuf::from(binary_name)
}

/// FFmpeg service for audio extraction and media processing
pub struct FFmpegService;

impl FFmpegService {
    /// Check if FFmpeg is available on the system
    pub async fn check_availability() -> Result<bool> {
        let ffmpeg_path = find_ffmpeg_path();
        let output = Command::new(&ffmpeg_path)
            .arg("-version")
            .output()
            .await;

        match output {
            Ok(o) => Ok(o.status.success()),
            Err(_) => Ok(false),
        }
    }

    /// Get FFmpeg version string
    pub async fn get_version() -> Result<String> {
        let ffmpeg_path = find_ffmpeg_path();
        let output = Command::new(&ffmpeg_path)
            .arg("-version")
            .output()
            .await
            .map_err(|e| AppError::FFmpeg(format!("Failed to run ffmpeg: {}", e)))?;

        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout);
            // Extract first line containing version info
            Ok(version.lines().next().unwrap_or("unknown").to_string())
        } else {
            Err(AppError::FFmpeg("FFmpeg not available".to_string()))
        }
    }

    /// Extract audio from a video/audio file to WAV format (16kHz mono for Whisper)
    pub async fn extract_audio<F>(
        input_path: &Path,
        output_path: &Path,
        on_progress: F,
    ) -> Result<PathBuf>
    where
        F: Fn(f32) + Send + 'static,
    {
        // First get duration for progress calculation
        let duration = Self::get_duration(input_path).await?;

        let ffmpeg_path = find_ffmpeg_path();
        let mut child = Command::new(&ffmpeg_path)
            .args([
                "-i",
                input_path.to_str().ok_or_else(|| AppError::InvalidPath("Invalid input path".to_string()))?,
                "-vn",                    // No video
                "-acodec", "pcm_s16le",   // PCM 16-bit
                "-ar", "16000",           // 16kHz sample rate (required for Whisper)
                "-ac", "1",               // Mono
                "-y",                     // Overwrite output
                "-progress", "pipe:1",    // Output progress to stdout
                output_path.to_str().ok_or_else(|| AppError::InvalidPath("Invalid output path".to_string()))?,
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| AppError::FFmpeg(format!("Failed to start ffmpeg: {}", e)))?;

        // Read progress from stdout
        if let Some(stdout) = child.stdout.take() {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                if line.starts_with("out_time_ms=") {
                    if let Ok(time_ms) = line.trim_start_matches("out_time_ms=").parse::<i64>() {
                        let time_sec = time_ms as f64 / 1_000_000.0;
                        let progress = (time_sec / duration * 100.0).min(100.0) as f32;
                        on_progress(progress);
                    }
                }
            }
        }

        let status = child.wait().await
            .map_err(|e| AppError::FFmpeg(format!("FFmpeg process error: {}", e)))?;

        if status.success() {
            on_progress(100.0);
            Ok(output_path.to_path_buf())
        } else {
            Err(AppError::FFmpeg("Audio extraction failed".to_string()))
        }
    }

    /// Get media file duration in seconds
    pub async fn get_duration(path: &Path) -> Result<f64> {
        let ffprobe_path = find_ffprobe_path();
        let output = Command::new(&ffprobe_path)
            .args([
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                path.to_str().ok_or_else(|| AppError::InvalidPath("Invalid path".to_string()))?,
            ])
            .output()
            .await
            .map_err(|e| AppError::FFmpeg(format!("Failed to run ffprobe: {}", e)))?;

        if output.status.success() {
            let duration_str = String::from_utf8_lossy(&output.stdout);
            duration_str
                .trim()
                .parse::<f64>()
                .map_err(|_| AppError::FFmpeg("Failed to parse duration".to_string()))
        } else {
            Err(AppError::FFmpeg("Failed to get media duration".to_string()))
        }
    }

    /// Get media file info (format, duration, codecs, etc.)
    pub async fn get_media_info(path: &Path) -> Result<MediaInfo> {
        let ffprobe_path = find_ffprobe_path();
        let output = Command::new(&ffprobe_path)
            .args([
                "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                "-show_streams",
                path.to_str().ok_or_else(|| AppError::InvalidPath("Invalid path".to_string()))?,
            ])
            .output()
            .await
            .map_err(|e| AppError::FFmpeg(format!("Failed to run ffprobe: {}", e)))?;

        if output.status.success() {
            let json_str = String::from_utf8_lossy(&output.stdout);
            let info: serde_json::Value = serde_json::from_str(&json_str)?;

            let format = info.get("format").and_then(|f| f.get("format_name"))
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string();

            let duration = info.get("format").and_then(|f| f.get("duration"))
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<f64>().ok())
                .unwrap_or(0.0);

            let has_video = info.get("streams")
                .and_then(|s| s.as_array())
                .map(|streams| streams.iter().any(|s| s.get("codec_type").and_then(|t| t.as_str()) == Some("video")))
                .unwrap_or(false);

            let has_audio = info.get("streams")
                .and_then(|s| s.as_array())
                .map(|streams| streams.iter().any(|s| s.get("codec_type").and_then(|t| t.as_str()) == Some("audio")))
                .unwrap_or(false);

            Ok(MediaInfo {
                format,
                duration,
                has_video,
                has_audio,
            })
        } else {
            Err(AppError::FFmpeg("Failed to get media info".to_string()))
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct MediaInfo {
    pub format: String,
    pub duration: f64,
    pub has_video: bool,
    pub has_audio: bool,
}
