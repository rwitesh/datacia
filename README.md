# DataCia

A fast, free desktop SQL client for PostgreSQL, MySQL, SQLite and ClickHouse, for macOS and Windows.

## Features

- **Connect anywhere** – PostgreSQL, MySQL, SQLite and ClickHouse, with optional SSH tunnelling
  (password or key). Saved credentials are encrypted on your machine.
- **SQL editor** – syntax highlighting, autocomplete for your tables, formatting, and inline
  suggestions drawn from the queries you have run before.
- **Results** – a fast table with sorting, column resizing and cell selection, plus a JSON view of
  the selected rows.
- **Export** – copy or export results as JSON, CSV or PNG.
- **Script mode** – run a sequence of statements one after another.
- **Query history and saved queries** – search past queries by text and date, and organise your
  own queries in folders.
- **AI assistant** – ask for SQL help with your own Google Gemini API key.
- **Make it yours** – light, dark or system theme, and configurable fonts and editor colours.
- **Automatic updates** – new versions download in the background and install on restart.

## Download

Get the latest version from [Releases](https://github.com/rwitesh/datacia/releases):

- **macOS** (Apple Silicon and Intel): `DataCia-<version>-darwin-universal.dmg`
- **Windows** (x64 and ARM64): `DataCia-<version>-windows-universal-installer.exe`

The other files in a release (`.zip`, per-architecture `.exe`, `SHA256SUMS`) are used by the app's
automatic updates; you don't need to download them.

## Install

**macOS** – open the `.dmg` and drag DataCia into Applications. The first time you open it, macOS
may say it can't verify the developer; open **System Settings → Privacy & Security** and choose
**Open Anyway**.

**Windows** – run the installer. It installs for the current user, so no administrator rights are
needed. If SmartScreen appears, choose **More info → Run anyway**.

## Building from source

See [DEVELOPMENT.md](DEVELOPMENT.md).
