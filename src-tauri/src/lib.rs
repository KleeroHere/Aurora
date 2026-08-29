use base64::Engine as _;
use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

//
// (`Path::new("C:/backups").join("C:/Windows/System32/x")` = `C:/Windows/...`),
//
//
#[derive(Default)]
struct AllowedDirs(Mutex<HashSet<PathBuf>>);

fn canonical_dir(path: &Path) -> Result<PathBuf, String> {
    fs::canonicalize(path).map_err(|e| format!("could not resolve path {}: {e}", path.display()))
}

fn allow_path(state: &AllowedDirs, path: &str) {
    let Some(parent) = Path::new(path).parent() else {
        return;
    };
    if let Ok(dir) = canonical_dir(parent) {
        if let Ok(mut set) = state.0.lock() {
            set.insert(dir);
        }
    }
}

fn sanitize_file_name(name: &str) -> Result<&str, String> {
    if name.is_empty() {
        return Err("the file name cannot be empty".to_string());
    }
    let mut components = Path::new(name).components();
    match (components.next(), components.next()) {
        (Some(Component::Normal(only)), None) if only == name => Ok(name),
        _ => Err(format!(
            "invalid file name \"{name}\": expected a plain name without separators, \"..\" or a root"
        )),
    }
}

fn check_within_allowed(path: &str, allowed: &HashSet<PathBuf>) -> Result<(), String> {
    let as_path = Path::new(path);
    let Some(file_name) = as_path.file_name().and_then(|n| n.to_str()) else {
        return Err(format!("path {path} contains no file name"));
    };
    sanitize_file_name(file_name)?;

    let parent = as_path
        .parent()
        .ok_or_else(|| format!("path {path} contains no folder"))?;
    let parent = canonical_dir(parent)?;

    if allowed.contains(&parent) {
        Ok(())
    } else {
        Err(format!(
            "access to {path} is denied: this location was not chosen by the user in a dialog. \
             If you need the file, open it through Sync - choosing the location is what grants permission."
        ))
    }
}

fn ensure_allowed(state: &AllowedDirs, path: &str) -> Result<(), String> {
    let set = state
        .0
        .lock()
        .map_err(|_| "internal error: the list of allowed locations is corrupted".to_string())?;
    check_within_allowed(path, &set)
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

//
//
// dumpFormat.ts/binary.ts).
//
//

fn write_dump_begin_impl(location: &str) -> Result<(), String> {
    fs::write(location, []).map_err(|e| format!("could not create file {location}: {e}"))
}

fn write_dump_append_impl(location: &str, chunk: &str) -> Result<(), String> {
    use std::io::Write;

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(chunk)
        .map_err(|e| format!("could not decode base64 for {location}: {e}"))?;
    let mut file = fs::OpenOptions::new()
        .append(true)
        .open(location)
        .map_err(|e| format!("could not open file for appending {location}: {e}"))?;
    file.write_all(&bytes)
        .map_err(|e| format!("could not append to file {location}: {e}"))
}

fn read_dump_impl(handle: &str) -> Result<tauri::ipc::Response, String> {
    let bytes = fs::read(handle).map_err(|e| format!("could not read file {handle}: {e}"))?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
fn write_dump_begin(allowed: tauri::State<'_, AllowedDirs>, location: String) -> Result<(), String> {
    ensure_allowed(&allowed, &location)?;
    write_dump_begin_impl(&location)
}

#[tauri::command]
fn write_dump_append(
    allowed: tauri::State<'_, AllowedDirs>,
    location: String,
    chunk: String,
) -> Result<(), String> {
    ensure_allowed(&allowed, &location)?;
    write_dump_append_impl(&location, &chunk)
}

#[tauri::command]
fn read_dump(
    allowed: tauri::State<'_, AllowedDirs>,
    handle: String,
) -> Result<tauri::ipc::Response, String> {
    ensure_allowed(&allowed, &handle)?;
    read_dump_impl(&handle)
}

#[tauri::command]
fn pick_file(
    app: tauri::AppHandle,
    allowed: tauri::State<'_, AllowedDirs>,
    filter: Option<SaveFilter>,
) -> Result<Option<String>, String> {
    let filter = filter.unwrap_or_else(|| SaveFilter {
        label: "Database dump (JSON)".to_string(),
        extensions: vec!["json".to_string()],
    });
    let extensions: Vec<&str> = filter.extensions.iter().map(String::as_str).collect();
    let path = app
        .dialog()
        .file()
        .add_filter(&filter.label, &extensions)
        .blocking_pick_file();
    let path = path.map(|p| p.to_string());
    if let Some(p) = &path {
        allow_path(&allowed, p);
    }
    Ok(path)
}

#[tauri::command]
fn pick_files(
    app: tauri::AppHandle,
    allowed: tauri::State<'_, AllowedDirs>,
) -> Result<Option<Vec<String>>, String> {
    let paths = app
        .dialog()
        .file()
        .set_title("Select the manifest AND every bundle part (Ctrl+click each file or Ctrl+A) - or a single regular dump file")
        .add_filter("Database dump / bundle (JSON)", &["json"])
        .blocking_pick_files();
    let paths: Option<Vec<String>> = paths.map(|ps| ps.into_iter().map(|p| p.to_string()).collect());
    if let Some(list) = &paths {
        for p in list {
            allow_path(&allowed, p);
        }
    }
    Ok(paths)
}

#[derive(serde::Deserialize)]
struct SaveFilter {
    label: String,
    extensions: Vec<String>,
}

#[tauri::command]
fn pick_save_location(
    app: tauri::AppHandle,
    allowed: tauri::State<'_, AllowedDirs>,
    suggested_name: String,
    title: String,
    filter: Option<SaveFilter>,
) -> Result<Option<String>, String> {
    let filter = filter.unwrap_or_else(|| SaveFilter {
        label: "Database dump (JSON)".to_string(),
        extensions: vec!["json".to_string()],
    });
    let extensions: Vec<&str> = filter.extensions.iter().map(String::as_str).collect();
    let path = app
        .dialog()
        .file()
        .set_title(&title)
        .add_filter(&filter.label, &extensions)
        .set_file_name(&suggested_name)
        .blocking_save_file();
    let path = path.map(|p| p.to_string());
    if let Some(p) = &path {
        allow_path(&allowed, p);
    }
    Ok(path)
}

fn primary_backup_dir() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|p| p.join("backups")))
}

fn resolve_backup_dir(app: &tauri::AppHandle) -> PathBuf {
    if let Some(dir) = primary_backup_dir() {
        if fs::create_dir_all(&dir).is_ok() {
            return dir;
        }
    }
    match app.path().app_local_data_dir() {
        Ok(dir) => dir.join("backups"),
        Err(_) => std::env::temp_dir().join("aurora-backups"),
    }
}

#[tauri::command]
fn resolve_backup_path(
    app: tauri::AppHandle,
    allowed: tauri::State<'_, AllowedDirs>,
    suggested_name: String,
) -> Result<String, String> {
    let name = sanitize_file_name(&suggested_name)?;
    let dir = resolve_backup_dir(&app);
    fs::create_dir_all(&dir).map_err(|e| format!("could not create backups folder {}: {e}", dir.display()))?;
    let path = dir.join(name).to_string_lossy().into_owned();
    allow_path(&allowed, &path);
    Ok(path)
}

//
//
//
fn videos_dir() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|p| p.join("videos")))
}

fn sanitize_relative_path(relative: &str) -> Result<PathBuf, String> {
    if relative.trim().is_empty() {
        return Err("the video path is empty".to_string());
    }
    let mut out = PathBuf::new();
    for part in relative.split(['/', '\\']) {
        match Path::new(part).components().next() {
            Some(Component::Normal(seg)) if seg == part && part != ".." && part != "." => out.push(seg),
            _ => {
                return Err(format!(
                    "invalid video path \"{relative}\": expected plain segments without \"..\" or a root"
                ))
            }
        }
    }
    Ok(out)
}

#[tauri::command]
fn resolve_video_path(relative_path: String) -> Result<String, String> {
    let safe = sanitize_relative_path(&relative_path)?;
    let dir = videos_dir().ok_or_else(|| "could not determine the app folder".to_string())?;
    let full = dir.join(&safe);
    if !full.is_file() {
        return Err(format!(
            "Video file not found: videos/{}. Videos are transferred separately from the database - \
             put the file into the videos folder next to the app.",
            relative_path
        ));
    }
    Ok(full.to_string_lossy().into_owned())
}

///
#[tauri::command]
fn dev_allow_dir(allowed: tauri::State<'_, AllowedDirs>, dir: String) -> Result<(), String> {
    if !cfg!(debug_assertions) {
        return Err("dev_allow_dir is available only in a dev build".to_string());
    }
    fs::create_dir_all(&dir).map_err(|e| format!("could not create folder {dir}: {e}"))?;
    let canonical = canonical_dir(Path::new(&dir))?;
    allowed
        .0
        .lock()
        .map_err(|_| "internal error: the list of allowed locations is corrupted".to_string())?
        .insert(canonical);
    Ok(())
}

//
//
fn resolve_seed_resource_path(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    if name.contains("..") {
        return Err(format!("invalid seed resource name: {name}"));
    }
    app.path()
        .resolve(format!("seed/{name}"), tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("could not find seed resource seed/{name}: {e}"))
}

#[tauri::command]
fn has_seed_resource(app: tauri::AppHandle) -> bool {
    resolve_seed_resource_path(&app, SEED_MANIFEST_NAME)
        .map(|p| p.is_file())
        .unwrap_or(false)
}

const SEED_MANIFEST_NAME: &str = "bundle.manifest.json";

#[tauri::command]
fn read_seed_resource(app: tauri::AppHandle, name: String) -> Result<tauri::ipc::Response, String> {
    let path = resolve_seed_resource_path(&app, &name)?;
    let bytes = fs::read(&path)
        .map_err(|e| format!("could not read seed resource {}: {e}", path.display()))?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_file_path(name: &str) -> String {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        env::temp_dir()
            .join(format!("aurora-lib-test-{nanos}-{name}"))
            .to_string_lossy()
            .into_owned()
    }

    #[test]
    fn write_dump_begin_then_append_writes_matching_bytes() {
        let path = temp_file_path("write.bin");
        let original: Vec<u8> = vec![0, 1, 2, 250, 251, 252, 253, 254, 255];
        let b64 = base64::engine::general_purpose::STANDARD.encode(&original);

        write_dump_begin_impl(&path).expect("write_dump_begin must not fail");
        write_dump_append_impl(&path, &b64).expect("write_dump_append must not fail on valid base64");

        let written = fs::read(&path).expect("the file must be written to disk");
        assert_eq!(written, original);
        fs::remove_file(&path).ok();
    }

    #[test]
    fn write_dump_append_concatenates_multiple_chunks_in_order() {
        let path = temp_file_path("write-multi.bin");
        let chunks: Vec<Vec<u8>> = vec![
            (0u8..=50).collect(),
            (51u8..=120).collect(),
            (121u8..=255).collect(),
        ];

        write_dump_begin_impl(&path).expect("write_dump_begin must not fail");
        for chunk in &chunks {
            let b64 = base64::engine::general_purpose::STANDARD.encode(chunk);
            write_dump_append_impl(&path, &b64).expect("write_dump_append must not fail on valid base64");
        }

        let expected: Vec<u8> = chunks.into_iter().flatten().collect();
        let written = fs::read(&path).expect("the file must be written to disk");
        assert_eq!(written, expected);
        fs::remove_file(&path).ok();
    }

    #[test]
    fn write_dump_append_rejects_invalid_base64_with_readable_error() {
        let path = temp_file_path("write-bad.bin");
        write_dump_begin_impl(&path).expect("write_dump_begin must not fail");
        let err = write_dump_append_impl(&path, "this is not base64 !!!")
            .expect_err("invalid base64 must return Err, not write garbage");
        assert!(err.contains(&path), "the error message must name the file path");
        fs::remove_file(&path).ok();
    }

    #[test]
    fn read_dump_reads_back_exactly_what_was_written() {
        use tauri::ipc::{InvokeResponseBody, IpcResponse};

        let path = temp_file_path("roundtrip.bin");
        let original: Vec<u8> = (0u16..=255).map(|b| b as u8).collect();
        fs::write(&path, &original).unwrap();

        let response = read_dump_impl(&path).expect("read_dump must read an existing file");
        match response.body().expect("the response body must build without errors") {
            InvokeResponseBody::Raw(bytes) => assert_eq!(bytes, original),
            InvokeResponseBody::Json(_) => panic!("read_dump must return Raw, not Json - otherwise it is number[] all over again"),
        }

        fs::remove_file(&path).ok();
    }

    #[test]
    fn primary_backup_dir_is_backups_next_to_running_executable() {
        let dir = primary_backup_dir().expect("current_exe() must be available in the test process");
        assert_eq!(dir.file_name().unwrap(), "backups");
        let exe = std::env::current_exe().unwrap();
        assert_eq!(dir.parent().unwrap(), exe.parent().unwrap());
    }

    //

    fn allowed_set(dir: &Path) -> HashSet<PathBuf> {
        let mut set = HashSet::new();
        set.insert(fs::canonicalize(dir).unwrap());
        set
    }

    fn temp_dir_with(name: &str) -> PathBuf {
        let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let dir = env::temp_dir().join(format!("aurora-allow-{nanos}-{name}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn sanitize_file_name_accepts_plain_name_only() {
        assert!(sanitize_file_name("aurora-dump.json").is_ok());

        for bad in [
            "",
            "..",
            "../../secret.json",
            "sub/dump.json",
            r"sub\dump.json",
            r"C:\Windows\System32\hosts",
            "/etc/passwd",
        ] {
            assert!(
                sanitize_file_name(bad).is_err(),
                "\"{bad}\" must be rejected: this is exactly how the path base used to get lost"
            );
        }
    }

    #[test]
    fn allowed_dir_permits_its_own_files_including_siblings() {
        let dir = temp_dir_with("siblings");
        let allowed = allowed_set(&dir);

        for name in ["aurora-dump.json", "aurora-dump.part001.json", "aurora-dump.manifest.json"] {
            let path = dir.join(name).to_string_lossy().into_owned();
            assert!(check_within_allowed(&path, &allowed).is_ok(), "{name} must be allowed");
        }
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn path_outside_allowed_dir_is_rejected() {
        let dir = temp_dir_with("inside");
        let other = temp_dir_with("outside");
        let allowed = allowed_set(&dir);

        let outsider = other.join("dump.json").to_string_lossy().into_owned();
        let err = check_within_allowed(&outsider, &allowed)
            .expect_err("a foreign folder was never chosen by the user - there must be no access");
        assert!(err.contains("denied"), "the message must explain the refusal in plain words: {err}");

        fs::remove_dir_all(&dir).ok();
        fs::remove_dir_all(&other).ok();
    }

    #[test]
    fn dot_dot_cannot_escape_allowed_dir() {
        let dir = temp_dir_with("escape");
        let allowed = allowed_set(&dir);

        let escaped = dir.join("..").join("escape-attempt.json").to_string_lossy().into_owned();
        assert!(
            check_within_allowed(&escaped, &allowed).is_err(),
            "escaping through \"..\" must be rejected"
        );
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn subdirectory_of_allowed_dir_is_not_allowed() {
        let dir = temp_dir_with("subdir");
        let nested = dir.join("nested");
        fs::create_dir_all(&nested).unwrap();
        let allowed = allowed_set(&dir);

        let path = nested.join("dump.json").to_string_lossy().into_owned();
        assert!(check_within_allowed(&path, &allowed).is_err());
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn nothing_is_allowed_before_any_dialog() {
        let dir = temp_dir_with("empty-state");
        let empty = HashSet::new();
        let path = dir.join("dump.json").to_string_lossy().into_owned();
        assert!(check_within_allowed(&path, &empty).is_err());
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn allow_path_registers_parent_directory_of_chosen_file() {
        let dir = temp_dir_with("register");
        let state = AllowedDirs::default();
        let chosen = dir.join("chosen.json").to_string_lossy().into_owned();

        assert!(ensure_allowed(&state, &chosen).is_err(), "before the dialog - not allowed");
        allow_path(&state, &chosen);
        assert!(ensure_allowed(&state, &chosen).is_ok(), "after the dialog - allowed");

        let sibling = dir.join("chosen.part001.json").to_string_lossy().into_owned();
        assert!(ensure_allowed(&state, &sibling).is_ok(), "and its sibling too");

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn video_path_accepts_simple_name_and_nested_folder() {
        assert_eq!(sanitize_relative_path("handover.mp4").unwrap(), PathBuf::from("handover.mp4"));
        assert_eq!(
            sanitize_relative_path("series/handover.mp4").unwrap(),
            PathBuf::from("series").join("handover.mp4")
        );
        assert_eq!(
            sanitize_relative_path(r"series\handover.mp4").unwrap(),
            PathBuf::from("series").join("handover.mp4")
        );
    }

    #[test]
    fn video_path_rejects_escape_from_videos_folder() {
        for bad in [
            "",
            "   ",
            "..",
            "../secret.mp4",
            "series/../../secret.mp4",
            "/etc/passwd",
            r"C:\Windows\System32\hosts",
            "./x.mp4",
        ] {
            assert!(
                sanitize_relative_path(bad).is_err(),
                "\"{bad}\" must be rejected: the path comes from a database that travels between machines"
            );
        }
    }

    #[test]
    fn resolve_video_path_reports_missing_file_in_human_words() {
        let err = resolve_video_path("definitely-no-such-file.mp4".to_string())
            .expect_err("a nonexistent video must yield Err, not an empty path");
        assert!(err.contains("not found"), "the message must explain what happened: {err}");
        assert!(err.contains("videos"), "and where to put the file: {err}");
    }

    #[test]
    fn read_dump_missing_file_gives_readable_error_not_panic() {
        let path = temp_file_path("does-not-exist.bin");
        match read_dump_impl(&path) {
            Err(err) => assert!(err.contains(&path)),
            Ok(_) => panic!("a nonexistent file must return Err, not Ok"),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AllowedDirs::default())
        .setup(|app| {
            if let Some(dir) = videos_dir() {
                let _ = fs::create_dir_all(&dir);
                app.asset_protocol_scope().allow_directory(&dir, true)?;
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            write_dump_begin,
            write_dump_append,
            read_dump,
            pick_file,
            pick_files,
            pick_save_location,
            resolve_backup_path,
            resolve_video_path,
            dev_allow_dir,
            has_seed_resource,
            read_seed_resource
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
