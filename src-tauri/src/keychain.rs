use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, Manager};

const KEYCHAIN_SERVICE: &str = "com.sigmabrain.desktop";
const KEYCHAIN_PROBE: &str = "__sigmabrain_keychain_probe__";

/// Secret metadata sidecar.
/// Does NOT contain the secret value; values live only in the OS keychain.
#[derive(Clone, Serialize, Deserialize)]
pub struct SecretMetadata {
    pub key: String,
    pub kind: String,
    pub created_at: String,
    pub updated_at: String,
    pub access_count: u32,
    pub last_accessed_at: Option<String>,
}

#[derive(Clone, Serialize)]
pub struct SecretMetadataResponse {
    pub key: String,
    pub kind: String,
    pub created_at: String,
    pub updated_at: String,
    pub access_count: u32,
    pub last_accessed_at: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SecretLifecycleEvent {
    key: String,
    kind: String,
    timestamp: String,
    success: bool,
    error_code: Option<String>,
}

fn get_metadata_dir(app: &AppHandle) -> std::path::PathBuf {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    let dir = app_data_dir.join("keychain");
    if !dir.exists() {
        let _ = std::fs::create_dir_all(&dir);
    }
    dir
}

fn get_metadata_path(app: &AppHandle) -> std::path::PathBuf {
    get_metadata_dir(app).join("metadata.json")
}

fn load_metadata(app: &AppHandle) -> HashMap<String, SecretMetadata> {
    let path = get_metadata_path(app);
    if !path.exists() {
        return HashMap::new();
    }
    match std::fs::read_to_string(&path) {
        Ok(content) => {
            if content.is_empty() {
                return HashMap::new();
            }
            serde_json::from_str(&content).unwrap_or_default()
        }
        Err(_) => HashMap::new(),
    }
}

fn save_metadata(app: &AppHandle, store: &HashMap<String, SecretMetadata>) -> Result<(), String> {
    let path = get_metadata_path(app);
    let content =
        serde_json::to_string_pretty(store).map_err(|e| format!("Serialize error: {}", e))?;

    // Metadata sidecar carries key names and timestamps, never values.
    // Restrictive permissions (0o600) keep it private on Unix.
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(&path)
            .map_err(|e| format!("File error: {}", e))?;
        use std::io::Write;
        file.write_all(content.as_bytes())
            .map_err(|e| format!("Write error: {}", e))?;
    }
    #[cfg(not(unix))]
    {
        std::fs::write(&path, content).map_err(|e| format!("Write error: {}", e))?;
    }

    Ok(())
}

fn now_rfc3339() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn map_keyring_error(err: keyring::Error) -> String {
    let msg = format!("{}", err);
    let code = match err {
        keyring::Error::NoEntry => "NOT_FOUND",
        keyring::Error::Invalid(_, _) => "INVALID_KEY",
        keyring::Error::PlatformFailure(_) | keyring::Error::NoStorageAccess(_) => {
            "STORE_UNAVAILABLE"
        }
        _ => "UNKNOWN",
    };
    format!("{}: {}", code, msg)
}

fn keyring_entry(key: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, key).map_err(map_keyring_error)
}

fn emit_event(
    app: &AppHandle,
    event: &str,
    key: &str,
    kind: &str,
    success: bool,
    error_code: Option<String>,
) {
    let payload = SecretLifecycleEvent {
        key: key.to_string(),
        kind: kind.to_string(),
        timestamp: now_rfc3339(),
        success,
        error_code,
    };
    let _ = app.emit(event, &payload);
}

#[tauri::command]
pub fn save_secret(
    app: AppHandle,
    key: String,
    value: String,
    kind: Option<String>,
) -> Result<(), String> {
    if key.is_empty() {
        return Err("INVALID_KEY: key must not be empty".to_string());
    }

    let kind = kind.unwrap_or_else(|| "generic".to_string());
    let entry = match keyring_entry(&key) {
        Ok(e) => e,
        Err(err) => {
            emit_event(&app, "secret-stored", &key, &kind, false, Some(err.clone()));
            return Err(err);
        }
    };

    if let Err(err) = entry.set_password(&value) {
        let mapped = map_keyring_error(err);
        emit_event(&app, "secret-stored", &key, &kind, false, Some(mapped.clone()));
        return Err(mapped);
    }

    let mut metadata = load_metadata(&app);
    let now = now_rfc3339();
    let existing = metadata.get(&key);
    metadata.insert(
        key.clone(),
        SecretMetadata {
            key: key.clone(),
            kind: kind.clone(),
            created_at: existing
                .map(|e| e.created_at.clone())
                .unwrap_or_else(|| now.clone()),
            updated_at: now,
            access_count: existing.map(|e| e.access_count).unwrap_or(0),
            last_accessed_at: existing.and_then(|e| e.last_accessed_at.clone()),
        },
    );

    if let Err(err) = save_metadata(&app, &metadata) {
        let _ = entry.delete_credential();
        emit_event(&app, "secret-stored", &key, &kind, false, Some(err.clone()));
        return Err(err);
    }

    emit_event(&app, "secret-stored", &key, &kind, true, None);
    Ok(())
}

#[tauri::command]
pub fn load_secret(app: AppHandle, key: String) -> Result<String, String> {
    if key.is_empty() {
        return Err("INVALID_KEY: key must not be empty".to_string());
    }

    let mut metadata = load_metadata(&app);
    let kind: String;
    {
        let meta = metadata.get_mut(&key).ok_or_else(|| {
            emit_event(
                &app,
                "secret-loaded",
                &key,
                "generic",
                false,
                Some("NOT_FOUND".to_string()),
            );
            "NOT_FOUND: secret not found".to_string()
        })?;
        kind = meta.kind.clone();
    }

    let entry = match keyring_entry(&key) {
        Ok(e) => e,
        Err(err) => {
            emit_event(&app, "secret-loaded", &key, &kind, false, Some(err.clone()));
            return Err(err);
        }
    };

    match entry.get_password() {
        Ok(value) => {
            {
                let meta = metadata
                    .get_mut(&key)
                    .expect("metadata entry disappeared after keychain read");
                meta.access_count += 1;
                meta.last_accessed_at = Some(now_rfc3339());
            }
            let _ = save_metadata(&app, &metadata);
            emit_event(&app, "secret-loaded", &key, &kind, true, None);
            Ok(value)
        }
        Err(err) => {
            let mapped = map_keyring_error(err);
            emit_event(&app, "secret-loaded", &key, &kind, false, Some(mapped.clone()));
            Err(mapped)
        }
    }
}

#[tauri::command]
pub fn delete_secret(app: AppHandle, key: String) -> Result<(), String> {
    if key.is_empty() {
        return Err("INVALID_KEY: key must not be empty".to_string());
    }

    let mut metadata = load_metadata(&app);
    let meta = metadata.get(&key).cloned();

    let entry = match keyring_entry(&key) {
        Ok(e) => e,
        Err(err) => {
            emit_event(
                &app,
                "secret-deleted",
                &key,
                &meta.as_ref().map(|m| m.kind.clone()).unwrap_or_else(|| "generic".to_string()),
                false,
                Some(err.clone()),
            );
            return Err(err);
        }
    };

    if let Err(err) = entry.delete_credential() {
        // Deleting an existing secret is safe to ignore; only fail on real access errors.
        if !matches!(err, keyring::Error::NoEntry) {
            let mapped = map_keyring_error(err);
            emit_event(
                &app,
                "secret-deleted",
                &key,
                &meta.as_ref().map(|m| m.kind.clone()).unwrap_or_else(|| "generic".to_string()),
                false,
                Some(mapped.clone()),
            );
            return Err(mapped);
        }
    }

    if metadata.remove(&key).is_none() {
        return Err("NOT_FOUND: secret not found".to_string());
    }

    if let Err(err) = save_metadata(&app, &metadata) {
        emit_event(
            &app,
            "secret-deleted",
            &key,
            &meta.as_ref().map(|m| m.kind.clone()).unwrap_or_else(|| "generic".to_string()),
            false,
            Some(err.clone()),
        );
        return Err(err);
    }

    emit_event(
        &app,
        "secret-deleted",
        &key,
        &meta.as_ref().map(|m| m.kind.clone()).unwrap_or_else(|| "generic".to_string()),
        true,
        None,
    );
    Ok(())
}

#[tauri::command]
pub fn has_secret(_app: AppHandle, key: String) -> Result<bool, String> {
    if key.is_empty() {
        return Err("INVALID_KEY: key must not be empty".to_string());
    }

    let entry = keyring_entry(&key)?;
    match entry.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(err) => Err(map_keyring_error(err)),
    }
}

#[tauri::command]
pub fn list_secrets(app: AppHandle) -> Result<Vec<SecretMetadataResponse>, String> {
    let metadata = load_metadata(&app);
    let mut result: Vec<SecretMetadataResponse> = Vec::with_capacity(metadata.len());

    // Only return entries whose metadata exists; do not expose values.
    for meta in metadata.values() {
        result.push(SecretMetadataResponse {
            key: meta.key.clone(),
            kind: meta.kind.clone(),
            created_at: meta.created_at.clone(),
            updated_at: meta.updated_at.clone(),
            access_count: meta.access_count,
            last_accessed_at: meta.last_accessed_at.clone(),
        });
    }

    Ok(result)
}

#[tauri::command]
pub fn is_keychain_available(app: AppHandle) -> Result<bool, String> {
    let _ = get_metadata_dir(&app);

    match keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_PROBE) {
        Ok(entry) => match entry.set_password("probe") {
            Ok(_) => {
                let _ = entry.delete_credential();
                Ok(true)
            }
            Err(_) => Ok(false),
        },
        Err(_) => Ok(false),
    }
}
