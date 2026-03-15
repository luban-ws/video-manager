// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod filesystem;
mod frontmatter;
mod video;
mod search;
mod git;
pub mod native_video;
pub mod scanner;
pub mod watcher;

fn main() {
    tauri::Builder::default()
        .manage(watcher::WatcherState::new())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::scan_library,
            commands::extract_video_and_create_file,
            commands::read_markdown_file,
            commands::save_markdown_file,
            commands::delete_markdown_file,
            commands::list_files,
            commands::search_files,
            commands::search_by_tags,
            commands::get_all_tags,
            commands::is_directory_empty,
            commands::create_directory,
            commands::save_pasted_image,
            commands::git_init,
            commands::git_add,
            commands::git_commit,
            commands::git_status,
            commands::git_history,
            commands::play_video_with_vlc,
            commands::check_vlc_available,
            watcher::watch_directory,
            watcher::unwatch_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
