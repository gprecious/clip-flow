use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Receiver};
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

/// Create a file watcher for a directory
pub fn create_watcher(
    path: &Path,
) -> Result<(RecommendedWatcher, Receiver<Result<Event, notify::Error>>), String> {
    let (tx, rx) = channel();

    let mut watcher = RecommendedWatcher::new(
        move |res| {
            let _ = tx.send(res);
        },
        Config::default(),
    )
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    watcher
        .watch(path, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch directory: {}", e))?;

    Ok((watcher, rx))
}

/// Get the relative path from root
pub fn get_relative_path(root: &Path, full_path: &Path) -> Option<PathBuf> {
    full_path.strip_prefix(root).ok().map(|p| p.to_path_buf())
}
