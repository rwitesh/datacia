# DataCia

A fast, free desktop SQL client for PostgreSQL, MySQL, SQLite and ClickHouse, on macOS and Windows.

## Features

- **Connect anywhere** – PostgreSQL, MySQL, SQLite and ClickHouse, directly or through an SSH
  tunnel, with SSL/TLS encryption.
- **SQL editor** – syntax highlighting, autocomplete for your tables, formatting, and suggestions
  based on queries you've run before.
- **Results** – a quick table with sorting, resizable columns and cell selection, plus a JSON view.
- **Export** – copy or save results as JSON, CSV or PNG.
- **History and saved queries** – search past queries, and keep your own in folders.
- **AI assistant** – ask about your queries and data in chat tabs or next to your query, see the
  rows it read, and reopen past chats. Works with Anthropic, OpenAI, Google Gemini, OpenRouter,
  OpenCode or a local model (Ollama, LM Studio), using your own API key.
- **Make it yours** – light or dark theme, and your choice of fonts and editor colours.
- **Automatic updates** – new versions download in the background and install on restart.

## Download

Get the latest version from [Releases](https://github.com/rwitesh/datacia/releases):

- **macOS** (Apple Silicon and Intel): `DataCia-<version>-darwin-universal.dmg`
- **Windows** (x64 and ARM64): `DataCia-<version>-windows-universal-installer.exe`

Smaller single-architecture downloads use `arm64` (Apple Silicon, Windows ARM64) or `amd64`
(Intel Mac, Windows x64) in place of `universal`.

You can ignore the other files in a release; the app uses them for updates.

## Install

**macOS** – open the `.dmg` and drag DataCia into Applications. If macOS says it can't verify the
developer the first time you open it, go to **System Settings → Privacy & Security** and choose
**Open Anyway**.

**Windows** – run the installer. No administrator rights needed. If SmartScreen appears, choose
**More info → Run anyway**.

## Secure connections

PostgreSQL, MySQL and ClickHouse connections have an **SSL** option:

- **Verify** – encrypts the connection and checks the server's certificate. Use this when you can.
- **Require** – encrypts, but doesn't check who the server is.
- **Disable** – no encryption.
- **Auto** (default) – leaves it to the database driver, which may not encrypt at all.

For a server with a private certificate, choose its CA file. ClickHouse uses its secure port for
encrypted connections (9440 by default).

## Privacy

- **Your passwords** and API keys are stored encrypted on your computer.
- **Error reports** are anonymous and help fix bugs. They never include your queries, results or
  passwords. You can turn them off in **Settings → Privacy**.
- **The AI assistant** only sends data when you use it, and only to the provider you pick: your
  messages, the database type, the SQL in the current tab and its last error, and whatever it
  reads from your database to answer. Each chat chooses what it can read: nothing, table names
  and structure (the default), or also a limited number of rows from read-only queries. The chat
  shows each step it takes and the rows it reads.
- **Chats** are saved on your computer, including the rows the AI read, so you can reopen them.
  Deleting a chat from its history removes it.

## Building from source

See [DEVELOPMENT.md](DEVELOPMENT.md).

## License

DataCia is free software under the [GNU General Public License v3.0](LICENSE). You can use, study,
change and share it. If you distribute a modified version, you must release its source under the
same license.
