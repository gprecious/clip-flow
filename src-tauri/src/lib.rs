mod commands;
mod error;
mod services;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(WatcherState::default())
        .invoke_handler(tauri::generate_handler![
            // FFmpeg commands
            check_ffmpeg,
            get_ffmpeg_version,
            get_media_info,
            extract_audio,
            get_media_duration,
            // Model commands
            get_available_models,
            get_installed_models,
            get_models_status,
            is_model_installed,
            download_model,
            delete_model,
            get_models_directory,
            // Transcription commands
            transcribe_media,
            transcribe_audio,
            check_whisper_available,
            install_whisper_cpp,
            // Ollama commands
            check_ollama,
            list_ollama_models,
            ollama_generate,
            ollama_chat,
            summarize_text,
            extract_story_order,
            pull_ollama_model,
            delete_ollama_model,
            // Cloud API commands
            store_api_key,
            get_api_key_masked,
            delete_api_key,
            get_api_key_status,
            validate_openai_key,
            validate_openai_key_direct,
            openai_transcribe,
            openai_chat,
            openai_summarize,
            get_openai_models,
            fetch_openai_models,
            fetch_openai_models_direct,
            validate_claude_key,
            validate_claude_key_direct,
            claude_chat,
            claude_summarize,
            get_claude_models,
            fetch_claude_models,
            fetch_claude_models_direct,
            // Directory commands
            scan_media_directory,
            scan_media_directory_tree,
            start_watching_directory,
            stop_watching_directory,
            get_watched_directory,
            is_media_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
