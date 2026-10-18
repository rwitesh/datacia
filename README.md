# DataCia

A fast, free desktop SQL client for PostgreSQL, MySQL, SQLite and ClickHouse, for macOS and Windows.

## Features

- **Connect anywhere** – PostgreSQL, MySQL, SQLite and ClickHouse, with optional SSH tunnelling
  (password or key). Saved credentials are encrypted on your machine.
- **SQL editor** – syntax highlighting, autocomplete for your tables, formatting, and inline
  suggestions drawn from the queries you have run before.
- **Results** – a fast table with sorting, column resizing and cell selection, plus a JSON view of
  the selected rows.
- **Export** – copy or export results as JSON, CSV or PNG. The editor loads at most 10,000 rows per
  query; exports contain only the rows shown.
- **Script mode** – run a sequence of statements one after another.
- **Query history and saved queries** – search past queries by text and date, and organise your
  own queries in folders.
- **AI assistant** – chat about your queries with Anthropic, OpenAI, Google Gemini, OpenRouter,
  OpenCode or a local OpenAI-compatible model (Ollama, LM Studio), using your own API key.
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

## Encrypted connections (SSL/TLS)

PostgreSQL, MySQL and ClickHouse connections have an **SSL** setting:

| Mode | Behavior |
| --- | --- |
| **Auto** (default) | The driver default: PostgreSQL tries TLS without checking the certificate and may fall back to plaintext; MySQL and ClickHouse use plaintext. |
| **Disable** | Never encrypts. |
| **Require** | Always encrypts, but doesn't check the server's certificate, so it doesn't stop impersonation. |
| **Verify** | Always encrypts and checks the certificate chain and host name, against the system roots, or a CA file for a private CA. |

Connections saved earlier keep Auto, which is unsafe on untrusted networks. If a connection fails after choosing Require or Verify, the server may
lack TLS (1.2 or newer) or its certificate may not be trusted. ClickHouse needs its secure native
port (9440 by default). With an SSH tunnel the certificate is checked against the host you typed.

## Privacy

DataCia sends anonymous error reports (crashes, error messages, app version, OS and an anonymous
device ID) to help fix bugs. Queries, results and passwords are never sent. Turn this off in
**Settings → Privacy**.

The AI assistant sends your messages, the SQL in the active tab and its last error to the AI
provider you choose. To answer from your data it can also read the connected database, and what it
reads is sent too: table names, table definitions (`CREATE TABLE` statements), and the rows of
read-only queries it runs (at most 200 rows and 16 KB per query, long values cut to 200
characters). The chat shows each of these as it happens. Nothing else is sent.

## Building from source

See [DEVELOPMENT.md](DEVELOPMENT.md).

## License

DataCia is free software, licensed under the [GNU General Public License v3.0](LICENSE).
You can use, study, change and share it. If you distribute a modified version, you must
release its source code under the same license.
