# How the AI agent works

This explains the AI chat's harness: the loop that lets the model look at your database, how it
stays safe and cheap, and how chats are saved. The code is in `internal/ai`.

## The idea

The model doesn't know your database. Instead of guessing, it gets a few tools to look things up.
It asks for a tool, we run it and hand back the result, and the model decides what to do next.
That repeats until it has enough to answer.

```
You ask a question
   │
   ▼
Model thinks ──► "I'll check which tables exist"   (text)
   │
   ├──► calls list_tables ──► we run it ──► result goes back to the model
   │
Model thinks ──► "The logs table looks right, let me check its size"
   │
   ├──► calls run_query ──► we run it ──► rows go back to the model
   │
Model answers ──► "There are about 2 million rows from the last week…"
```

Each round of "think, maybe call tools" is one **step**.

## The tools

The model can only read. It has four tools:

| Tool | What it does |
| --- | --- |
| `get_editor` | Reads the SQL in your current tab and its last error |
| `list_tables` | Lists the tables (up to 500, optionally filtered by name) |
| `describe_table` | Shows a table's columns and types |
| `run_query` | Runs one read-only query and returns its rows (20 by default, 200 at most) |

When a tool fails, the error goes back to the model as text, so it can fix its query and try
again.

## Steps and the final answer

The model gets up to **25 steps** per reply. Database questions often need several lookups, so
this leaves room to explore; it's a ceiling, not a target.

If the model is still calling tools when the 25 steps run out, it hasn't answered yet. We then
make **one more call with tools switched off**, so the model has to answer from what it has
already found. Nothing extra is added to the conversation; the model just can't call a tool on
that last turn. The library we use (goai) has no built-in "final answer" mode, so this is done
in `streamReply`.

A whole reply can take at most 10 minutes. Pressing Stop cancels it at any point, including a
query that is still running.

## Keeping the database safe and fast

Every query the AI runs goes through these guards:

1. **Read-only, checked twice.** The app first rejects anything that isn't a single read
   statement. The database itself is then told to refuse writes: a read-only transaction
   (Postgres, MySQL), a read-only setting (ClickHouse) or a read-only connection (SQLite).
2. **30-second limit.** A query that runs longer is stopped, and the database is told to stop it
   too, so it doesn't keep working in the background.
3. **Small results.** The model is asked to fetch as few rows as answer the question, usually
   10–20, and to change its filter or range rather than fetch more. 200 rows and about 16 KB per
   query is the hard cap, with long values cut to 200 characters.
4. **Good habits in the prompt.** The model is told to check how big a table is from the
   database's own statistics before aggregating it, to filter large tables on their partition,
   sort or indexed columns, never to scan a whole large table, and not to retry a query that
   timed out.

## The prompt and caching

The system prompt never changes: it is the same for every chat and every database. The database
type (ClickHouse, Postgres and so on) is named in a short note on the first message instead, which
stays put until the chat is longer than the 20 turns we send. The tool definitions never change
either.

That matters because every step of the loop resends the system prompt, the tools and the
conversation so far. When the start of each request is identical, providers can **cache** it and
skip reprocessing it, which makes later steps faster and cheaper:

- **Anthropic** needs caching switched on, so we do. We also mark the end of the conversation so
  every tool step in a reply reuses it.
- **OpenAI and Gemini** cache repeated prefixes automatically.

To keep caching working, anything that changes per message (like your current SQL) stays out of
the system prompt. The model reads it with `get_editor` when it needs it.

### Token usage

Every model call reports its tokens. We add them up per reply and show them next to the message
box as a small ring and a number:

- **The ring** fills to the share of the reply's input that the provider served from its cache:
  green when most of it was, amber when some was. A full ring means caching is working.
- **The number** is the context: how many tokens the last call sent, which is how full the
  conversation is.

Hovering shows the details (context, input, cached and output tokens). The numbers are saved
with the reply.

## What the chat shows

While the model works, the chat updates live. A reply is a list of **parts**, in the order they
happened: a bit of text, then a tool call, then more text. So you see "I'll check the table
sizes", then that query with its rows, then what the model concluded.

Each tool call appears when it starts and updates when it finishes, with its error or result.
For queries, the table you see is exactly what the model read: the same capped rows, not a
re-run.

## How chats are saved

Chats are stored on your computer in the app's local SQLite database (`data.db`), in one table:

| Column | Holds |
| --- | --- |
| `id` | The chat's ID |
| `title` | The first line of your first message |
| `messages` | The whole conversation as JSON: every message and its parts, including query rows |
| `created_at`, `updated_at` | When it was started and last changed |

- A new chat is saved after its first reply, and saved again after each reply. Closing a tab
  while it is answering stops the reply and saves what it had so far.
- Saving replaces the whole chat. It keeps the latest 200 messages.
- The history list reads only the titles and times, so it stays quick.
- Deleting a chat removes its row.

Only the text of earlier messages is sent back to the model with a new question (the last 20
turns), not old query results, which keeps requests small.
