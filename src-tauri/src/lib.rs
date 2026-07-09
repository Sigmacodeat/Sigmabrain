use serde::Serialize;
use tauri::{Emitter, Manager, WindowEvent};

mod keychain;

#[derive(Clone, Serialize)]
struct ShellStartedPayload {
    version: String,
    platform: String,
    timestamp: String,
}

#[derive(Clone, Serialize)]
struct ShellReadyPayload {
    window_title: String,
    timestamp: String,
}

#[tauri::command]
fn get_shell_info(app: tauri::AppHandle) -> ShellStartedPayload {
    ShellStartedPayload {
        version: app.package_info().version.to_string(),
        platform: std::env::consts::OS.to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    }
}

#[tauri::command]
fn shell_ready(window: tauri::Window) -> ShellReadyPayload {
    ShellReadyPayload {
        window_title: window.title().unwrap_or_default(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let main_window = app.get_webview_window("main").expect("main window not found");

            // Emit DesktopShellStarted event
            let payload = ShellStartedPayload {
                version: app.package_info().version.to_string(),
                platform: std::env::consts::OS.to_string(),
                timestamp: chrono::Utc::now().to_rfc3339(),
            };
            main_window.emit("desktop-shell-started", &payload)?;

            // Emit DesktopShellReady after window is shown
            let ready_window = main_window.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                let payload = ShellReadyPayload {
                    window_title: ready_window.title().unwrap_or_default(),
                    timestamp: chrono::Utc::now().to_rfc3339(),
                };
                let _ = ready_window.emit("desktop-shell-ready", &payload);
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                // Cleanup hook — allows frontend to perform cleanup before exit
                let _ = window.emit("desktop-shell-closing", &());
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_shell_info,
            shell_ready,
            keychain::save_secret,
            keychain::load_secret,
            keychain::delete_secret,
            keychain::has_secret,
            keychain::list_secrets,
            keychain::is_keychain_available,
        ])
        .run(tauri::generate_context!())
        .expect("error while running SigmaBrain Desktop");
}
