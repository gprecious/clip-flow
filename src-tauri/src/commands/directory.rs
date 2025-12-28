use crate::services::directory_service::{
    scan_directory, scan_directory_tree, DirectoryNode, FileEntry, FileEvent,
};
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

/// Global state for the file watcher
pub struct WatcherState {
    watcher: Mutex<Option<RecommendedWatcher>>,
    watched_path: Mutex<Option<String>>,
}

impl Default for WatcherState {
    fn default() -> Self {
        Self {
            watcher: Mutex::new(None),
            watched_path: Mutex::new(None),
        }
    }
}

/// Scan directory and return flat list of media files
#[tauri::command]
pub async fn scan_media_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let path = PathBuf::from(&path);
    scan_directory(&path)
}

/// Scan directory and return tree structure
#[tauri::command]
pub async fn scan_media_directory_tree(path: String) -> Result<DirectoryNode, String> {
    let path = PathBuf::from(&path);
    scan_directory_tree(&path)
}

/// Start watching a directory for changes
#[tauri::command]
pub async fn start_watching_directory(
    app: AppHandle,
    path: String,
    state: State<'_, WatcherState>,
) -> Result<(), String> {
    let watch_path = PathBuf::from(&path);

    if !watch_path.exists() {
        return Err(format!("Directory does not exist: {}", path));
    }

    // Stop any existing watcher
    {
        let mut watcher_guard = state.watcher.lock().map_err(|e| e.to_string())?;
        *watcher_guard = None;
    }

    // Create new watcher
    let app_handle = app.clone();
    let watched_path_clone = path.clone();

    let watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                let file_events: Vec<FileEvent> = event
                    .paths
                    .iter()
                    .filter_map(|p| {
                        // Only emit events for supported media files
                        if p.is_file()
                            && !crate::services::directory_service::is_supported_media(p)
                        {
                            return None;
                        }

                        let path_str = p.to_string_lossy().to_string();

                        match event.kind {
                            EventKind::Create(_) => Some(FileEvent::Created(path_str)),
                            EventKind::Modify(_) => Some(FileEvent::Modified(path_str)),
                            EventKind::Remove(_) => Some(FileEvent::Removed(path_str)),
                            _ => None,
                        }
                    })
                    .collect();

                for file_event in file_events {
                    let _ = app_handle.emit("file-change", &file_event);
                }
            }
        },
        Config::default(),
    )
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    // Start watching
    {
        let mut watcher_guard = state.watcher.lock().map_err(|e| e.to_string())?;

        let mut w = watcher;
        w.watch(&watch_path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch directory: {}", e))?;

        *watcher_guard = Some(w);
    }

    // Store the watched path
    {
        let mut path_guard = state.watched_path.lock().map_err(|e| e.to_string())?;
        *path_guard = Some(watched_path_clone);
    }

    Ok(())
}

/// Stop watching the current directory
#[tauri::command]
pub async fn stop_watching_directory(state: State<'_, WatcherState>) -> Result<(), String> {
    let mut watcher_guard = state.watcher.lock().map_err(|e| e.to_string())?;
    *watcher_guard = None;

    let mut path_guard = state.watched_path.lock().map_err(|e| e.to_string())?;
    *path_guard = None;

    Ok(())
}

/// Get the currently watched directory
#[tauri::command]
pub async fn get_watched_directory(state: State<'_, WatcherState>) -> Result<Option<String>, String> {
    let path_guard = state.watched_path.lock().map_err(|e| e.to_string())?;
    Ok(path_guard.clone())
}

/// Check if a specific file is a supported media file
#[tauri::command]
pub fn is_media_file(path: String) -> bool {
    let path = PathBuf::from(&path);
    crate::services::directory_service::is_supported_media(&path)
}
