use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::SystemTime;
use walkdir::WalkDir;

/// Represents a file entry in the directory
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub is_dir: bool,
    pub modified: Option<u64>,
    pub extension: Option<String>,
}

/// Represents a directory tree node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryNode {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<u64>,
    pub extension: Option<String>,
    pub children: Vec<DirectoryNode>,
}

/// File event types for watching
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "path")]
pub enum FileEvent {
    Created(String),
    Modified(String),
    Removed(String),
}

/// Supported media extensions
const SUPPORTED_EXTENSIONS: &[&str] = &[
    "mp4", "mkv", "avi", "mov", "webm", "flv", "wmv", // video
    "mp3", "wav", "m4a", "flac", "aac", "ogg", "wma", // audio
];

/// Check if a file has a supported media extension
pub fn is_supported_media(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Scan a directory and return all media files
pub fn scan_directory(root_path: &Path) -> Result<Vec<FileEntry>, String> {
    if !root_path.exists() {
        return Err(format!("Directory does not exist: {:?}", root_path));
    }

    let mut files = Vec::new();

    for entry in WalkDir::new(root_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        // Skip directories
        if path.is_dir() {
            continue;
        }

        // Only include supported media files
        if !is_supported_media(path) {
            continue;
        }

        if let Ok(metadata) = entry.metadata() {
            let modified = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                .map(|d| d.as_secs());

            files.push(FileEntry {
                path: path.to_string_lossy().to_string(),
                name: path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default(),
                size: metadata.len(),
                is_dir: false,
                modified,
                extension: path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|s| s.to_lowercase()),
            });
        }
    }

    // Sort by path
    files.sort_by(|a, b| a.path.cmp(&b.path));

    Ok(files)
}

/// Scan a directory and return a tree structure
pub fn scan_directory_tree(root_path: &Path) -> Result<DirectoryNode, String> {
    if !root_path.exists() {
        return Err(format!("Directory does not exist: {:?}", root_path));
    }

    build_tree_node(root_path)
}

fn build_tree_node(path: &Path) -> Result<DirectoryNode, String> {
    let metadata = std::fs::metadata(path)
        .map_err(|e| format!("Failed to read metadata for {:?}: {}", path, e))?;

    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| d.as_secs());

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());

    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase());

    if metadata.is_dir() {
        let mut children = Vec::new();

        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.filter_map(|e| e.ok()) {
                let child_path = entry.path();

                // Skip hidden files/directories
                if child_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.starts_with('.'))
                    .unwrap_or(false)
                {
                    continue;
                }

                // For files, only include supported media
                if child_path.is_file() && !is_supported_media(&child_path) {
                    continue;
                }

                if let Ok(child_node) = build_tree_node(&child_path) {
                    // Only include directories that have media files (directly or in subdirs)
                    if child_node.is_dir && child_node.children.is_empty() {
                        continue;
                    }
                    children.push(child_node);
                }
            }
        }

        // Sort: directories first, then files, alphabetically
        children.sort_by(|a, b| {
            match (a.is_dir, b.is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            }
        });

        Ok(DirectoryNode {
            path: path.to_string_lossy().to_string(),
            name,
            is_dir: true,
            size: 0,
            modified,
            extension: None,
            children,
        })
    } else {
        Ok(DirectoryNode {
            path: path.to_string_lossy().to_string(),
            name,
            is_dir: false,
            size: metadata.len(),
            modified,
            extension,
            children: Vec::new(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use tempfile::TempDir;

    #[test]
    fn test_is_supported_media_video_files() {
        assert!(is_supported_media(Path::new("video.mp4")));
        assert!(is_supported_media(Path::new("video.mkv")));
        assert!(is_supported_media(Path::new("video.avi")));
        assert!(is_supported_media(Path::new("video.mov")));
        assert!(is_supported_media(Path::new("video.webm")));
    }

    #[test]
    fn test_is_supported_media_audio_files() {
        assert!(is_supported_media(Path::new("audio.mp3")));
        assert!(is_supported_media(Path::new("audio.wav")));
        assert!(is_supported_media(Path::new("audio.m4a")));
        assert!(is_supported_media(Path::new("audio.flac")));
        assert!(is_supported_media(Path::new("audio.ogg")));
    }

    #[test]
    fn test_is_supported_media_case_insensitive() {
        assert!(is_supported_media(Path::new("video.MP4")));
        assert!(is_supported_media(Path::new("audio.MP3")));
        assert!(is_supported_media(Path::new("video.MKV")));
    }

    #[test]
    fn test_is_supported_media_unsupported_files() {
        assert!(!is_supported_media(Path::new("document.pdf")));
        assert!(!is_supported_media(Path::new("image.jpg")));
        assert!(!is_supported_media(Path::new("text.txt")));
        assert!(!is_supported_media(Path::new("data.json")));
    }

    #[test]
    fn test_is_supported_media_no_extension() {
        assert!(!is_supported_media(Path::new("no_extension")));
        assert!(!is_supported_media(Path::new("folder/")));
    }

    #[test]
    fn test_scan_directory_nonexistent() {
        let result = scan_directory(Path::new("/nonexistent/path/12345"));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn test_scan_directory_empty() {
        let temp_dir = TempDir::new().unwrap();
        let result = scan_directory(temp_dir.path());
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }

    #[test]
    fn test_scan_directory_with_media_files() {
        let temp_dir = TempDir::new().unwrap();

        // Create test media files
        File::create(temp_dir.path().join("video.mp4")).unwrap();
        File::create(temp_dir.path().join("audio.mp3")).unwrap();
        File::create(temp_dir.path().join("document.pdf")).unwrap(); // Should be ignored

        let result = scan_directory(temp_dir.path());
        assert!(result.is_ok());

        let files = result.unwrap();
        assert_eq!(files.len(), 2);
        assert!(files.iter().any(|f| f.name == "video.mp4"));
        assert!(files.iter().any(|f| f.name == "audio.mp3"));
        assert!(!files.iter().any(|f| f.name == "document.pdf"));
    }

    #[test]
    fn test_scan_directory_tree_nonexistent() {
        let result = scan_directory_tree(Path::new("/nonexistent/path/12345"));
        assert!(result.is_err());
    }

    #[test]
    fn test_scan_directory_tree_empty() {
        let temp_dir = TempDir::new().unwrap();
        let result = scan_directory_tree(temp_dir.path());
        assert!(result.is_ok());

        let tree = result.unwrap();
        assert!(tree.is_dir);
        assert!(tree.children.is_empty()); // Empty dirs with no media are excluded
    }

    #[test]
    fn test_scan_directory_tree_with_files() {
        let temp_dir = TempDir::new().unwrap();

        // Create test files
        File::create(temp_dir.path().join("video.mp4")).unwrap();
        File::create(temp_dir.path().join("audio.mp3")).unwrap();

        let result = scan_directory_tree(temp_dir.path());
        assert!(result.is_ok());

        let tree = result.unwrap();
        assert!(tree.is_dir);
        assert_eq!(tree.children.len(), 2);
    }

    #[test]
    fn test_scan_directory_tree_skips_hidden_files() {
        let temp_dir = TempDir::new().unwrap();

        // Create visible and hidden files
        File::create(temp_dir.path().join("video.mp4")).unwrap();
        File::create(temp_dir.path().join(".hidden.mp4")).unwrap();

        let result = scan_directory_tree(temp_dir.path());
        assert!(result.is_ok());

        let tree = result.unwrap();
        assert_eq!(tree.children.len(), 1);
        assert_eq!(tree.children[0].name, "video.mp4");
    }

    #[test]
    fn test_scan_directory_tree_nested_structure() {
        let temp_dir = TempDir::new().unwrap();

        // Create nested structure
        fs::create_dir(temp_dir.path().join("subdir")).unwrap();
        File::create(temp_dir.path().join("video.mp4")).unwrap();
        File::create(temp_dir.path().join("subdir").join("audio.mp3")).unwrap();

        let result = scan_directory_tree(temp_dir.path());
        assert!(result.is_ok());

        let tree = result.unwrap();
        assert!(tree.is_dir);
        assert_eq!(tree.children.len(), 2); // subdir and video.mp4

        // Find the subdir
        let subdir = tree.children.iter().find(|c| c.name == "subdir");
        assert!(subdir.is_some());
        assert!(subdir.unwrap().is_dir);
        assert_eq!(subdir.unwrap().children.len(), 1);
    }

    #[test]
    fn test_file_entry_extension() {
        let temp_dir = TempDir::new().unwrap();
        File::create(temp_dir.path().join("test.MP4")).unwrap();

        let result = scan_directory(temp_dir.path());
        assert!(result.is_ok());

        let files = result.unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].extension, Some("mp4".to_string())); // Should be lowercase
    }
}
