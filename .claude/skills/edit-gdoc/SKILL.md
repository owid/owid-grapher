---
name: edit-gdoc
description: Edit or create an unpublished OWID gdoc, or check or read any registered one (article, data insight, any gdoc type), as ArchieML text through the local or staging admin API. Use when an engineer asks to change a test gdoc's content, create a new gdoc draft from ArchieML, or check a gdoc's errors and warnings — given a doc id or docs.google.com URL, on localhost or on staging-site-<branch>.
allowed-tools:
    - Read
    - Edit
    - Write
    - Bash(curl:*)
    - Bash(jq:*)
metadata:
    internal: true
---

# Edit, create and check gdocs as ArchieML

Three admin routes read and write a gdoc's ArchieML text. Writes need **unpublished** docs outside shared drives; GET reads any registered doc. A write **replaces the whole doc**: Google comments and any styling the parser ignores are lost. The old version stays in the doc's revision history (File → Version history).

The doc id is the part of the URL after `/document/d/`.

## Host

- Default: the local admin of the checkout you are in. Worktrees use their own port, so `Read` the `.env` at the checkout root and take `ADMIN_SERVER_PORT` (3030 when unset). `HOST=http://localhost:<port>`.
- When the user names a branch: `HOST=http://staging-site-<branch>`, with slashes in the branch name turned into hyphens and the branch part truncated to 28 characters.
- No auth headers. Localhost logs you in automatically; staging knows you through Tailscale.

`$HOST`, `$ID`, `$REVISION_ID` and `$EMAIL` in the commands below are placeholders. Shell variables don't persist between Bash calls, so write the literal values into every command.

Keep local files in your session scratchpad directory, and use their absolute paths in commands.

The routes are under `$HOST/admin/api`. Errors come back as `{ "error": { "message", "status" } }`; the first line of `message` says what went wrong.

## Read a doc

Works on any registered doc, published or not.

1. Get the doc and check the response for `.error` (see Refusals):

    ```sh
    curl -s "$HOST/admin/api/gdocs/$ID/archieml" > doc.json
    jq '.error' doc.json
    ```

2. Only when that prints `null`, save its text, exactly, to a local file:

    ```sh
    jq -j .text doc.json > doc.archieml
    jq -r .revisionId doc.json
    ```

    `jq -j` keeps the text byte-exact (no added trailing newline).

## Edit a doc

Change a local copy of the text with `Edit`, then send that file. **Never retype the doc into a request** — that is where content gets lost.

1. Read the doc (see "Read a doc") and keep its `revisionId`. If `jq .published doc.json` prints `true`, stop: tell the user the doc is published and can only be read.

2. `Read` `doc.archieml`, then make the change with `Edit`. Touch only the lines that need to change.

3. Send the file:

    ```sh
    curl -s -X PUT "$HOST/admin/api/gdocs/$ID/archieml?revisionId=$REVISION_ID" \
        -H "Content-Type: text/plain; charset=utf-8" \
        --data-binary @doc.archieml | jq
    ```

    `--data-binary` sends the file as-is (`-d` would strip newlines).

4. Read the response (below). For another edit, use the new `revisionId` it returns, or GET again.

## Create a doc

Mirror a real doc of the same type. Field lists alone miss the structure (e.g. a data insight's text goes inside `[+body] … []`).

1. Find an exemplar of the type (`$TYPE`, e.g. `data-insight`):

    ```sh
    curl -s "$HOST/admin/api/gdocs-reference/templates/$TYPE/exemplars.json" | jq -r '.exemplars[0].gdocId'
    ```

    If that prints `null` or an error, take any doc of the type, published first:

    ```sh
    curl -s "$HOST/admin/api/gdocs" | jq -r --arg t "$TYPE" '[.[] | select(.type == $t)] | (map(select(.published)) + .)[0].id'
    ```

    If that prints `null` too, there is no doc of the type: build from the fields in `$HOST/admin/api/gdocs-reference/templates.json`, and tell the user the structure is unverified.

2. Read the exemplar as in "Read a doc" (`exemplar.json` → `exemplar.archieml`), then `Read` the local file. It is usually published and always read-only: a PUT on it returns 403, as does a PUT on any doc in a shared drive. Never send it.
3. `Write` the new doc to a local file, e.g. `new.archieml`. Mirror the exemplar's front matter and block layout; replace its content with yours. For block syntax, see `$HOST/admin/api/gdocs-reference/components.json`.
4. Share with the **Claude session's account email** (the user's email from your session context). If you don't know it, ask. Never guess.
5. Encode the email (a `+` in it would otherwise read as a space):

    ```sh
    jq -rn --arg e "$EMAIL" '$e|@uri'
    ```

    Then send the file, with that output written in as `$ENCODED_EMAIL`. Keep these as two separate Bash calls: a command that starts with a variable assignment doesn't match the `curl` allowlist.

    ```sh
    curl -s -X POST "$HOST/admin/api/gdocs/archieml?email=$ENCODED_EMAIL" \
        -H "Content-Type: text/plain; charset=utf-8" \
        --data-binary @new.archieml | jq
    ```

    Don't use `curl -G --data-urlencode`: `-G` moves the `--data-binary` body into the URL too.

6. If `report.errors` is non-empty, fix the errors in `new.archieml` with `Edit` and PUT it to the new `id` with the returned `revisionId` (as in "Edit a doc" step 3). Repeat until there are no errors. If an error is still there unchanged after a PUT, the text can't fix it: stop and tell the user about it.

The doc lands in the service account's Drive, shared with that email as writer, and registered in the admin. Give the user the `url`.

## Check a doc

Shows the report on the doc **as stored in Google**. Writes nothing. Unsaved local text can't be checked.

```sh
curl -s "$HOST/admin/api/gdocs/$ID/archieml" | jq '.error // .report'
```

If it prints an `error`, handle it as in Refusals.

List `report.errors` (block publishing) and `report.warnings`, each with its `property` and `message`.

## Responses

| Route                                  | 200 body                                    |
| -------------------------------------- | ------------------------------------------- |
| `GET /gdocs/:id/archieml`              | `{ text, revisionId, report, published }`   |
| `PUT /gdocs/:id/archieml?revisionId=…` | `{ revisionId, readBack, report }`          |
| `POST /gdocs/archieml?email=…`         | `{ id, url, revisionId, readBack, report }` |

- `report: { errors, warnings }` — the admin's publishability checks. A doc with errors is **still written**; tell the user about them.
- `readBack.match: true` — Google stored exactly the text you sent. Done.
- `readBack.match: false` — Google stored something different. Nothing is rolled back. `readBack.line` is the first line that differs, with `sent` and `stored` (either is absent when that side has fewer lines). Show the user that line. **Don't retry blindly**: the same text will likely read back the same way.

## Refusals

Every 400, 403, 404 and 409 means **nothing was written**.

- **400** — fix and send again. Causes: the text doesn't parse, or its front-matter `type` is missing or invalid, or the admin can't load it; a missing `revisionId` (PUT) or `email` (POST); a body that isn't `text/plain`; a character Google would strip (the message gives the line and code point, e.g. `U+000D` — remove it from the file).
- **409** — the doc changed since your GET. GET again into a fresh file, re-apply your edit to it with `Edit`, and PUT with the new `revisionId`. Don't PUT your old file: it would undo the other change.
- **403** — the doc is published, or in a shared drive (an author's doc). This skill can only read it.
- **404** — the doc isn't registered in the admin. The user must add it once in the admin: `$HOST/admin/gdocs` → "Add document", paste the URL.
- **500 on PUT** — if the message says the shared-drive check failed, nothing was written; try again later. Otherwise the write may already have happened: GET again and compare its text with your file before sending anything again.
- **500 on create** — if the message names a docs URL (it starts `Created and shared https://docs.google.com/…` or `Created, shared and wrote https://docs.google.com/…`), that doc exists and is shared with the email, but may be empty or not registered. Give the user the URL; don't create again blindly. A 500 without a URL means no doc anyone can open was created. When sharing failed, the server deletes the new doc; if that delete fails too, an unshared doc stays in the service account's Drive (the server logs its id).
