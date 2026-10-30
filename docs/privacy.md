# Storage and permissions

Notebook starts with three sample notes. The installed plugin saves notes in a local SQLite database. It does not scan repositories, read unrelated files, store credentials, or create schedules. The plugin itself makes no network requests.

## Where the database lives

The database is outside the versioned plugin directory. Restarting Codex, updating the plugin, or removing its marketplace source does not erase it.

| System | Default file |
| --- | --- |
| macOS | `~/Library/Application Support/notebook/notebook.sqlite3` |
| Linux | `$XDG_DATA_HOME/notebook/notebook.sqlite3`, or `~/.local/share/notebook/notebook.sqlite3` |
| Windows | `%LOCALAPPDATA%\notebook\notebook.sqlite3` |

The directory follows the configured plugin name. `NOTEBOOK_DATA_DIR` can override it with an absolute directory path. The database filename remains `notebook.sqlite3`.

The server uses Node's [built-in SQLite module](https://nodejs.org/download/release/v22.13.1/docs/api/sqlite.html). It creates the initial schema and sample notes once. It uses prepared statements and WAL mode, so separate server processes can share the database without replacing each other's notes. The file is not encrypted.

Quit Codex before backing up or deleting the data directory. Back up the whole directory, including any SQLite sidecar files. Uninstalling the plugin keeps this directory. To remove all saved notes, quit Codex and delete the directory. A later start creates a new database with the sample notes.

## Browser preview

The preview saves a separate set of notes in local storage under the key `notebook:browser-preview`. Reloading the page keeps those notes. Clearing site data removes them. Different browser origins have separate data. The key follows the plugin name if you rename the template.

## What goes to Codex

Clicking **Work on this with Codex** sends the selected note's ID, title, body, and kind to the host conversation. It does not send other notes or silently edit a note. The browser preview shows a prompt instead. Copying it writes to the clipboard only when you click **Copy prompt**.

Tool arguments and results pass through Codex and can enter the conversation or model context. This is not local AI inference. `notebook_open` returns all saved notes, not just the selected note. Avoid storing sensitive data in the example.

`notebook_open` reads saved state. `notebook_create`, `notebook_update`, and `notebook_favorite` write to SQLite. Their MCP annotations describe those effects. Tool annotations inform the host; they do not replace server-side authorization for an external service.

When adapting the template, describe your storage, external services, authentication, retention, and deletion behavior here. Keep secrets and user databases out of source, logs, screenshots, and release archives.
