# Cloud saves through GitHub Gist

Mirror the game's saves to a GitHub Gist, so a save made on one machine can be loaded on
another. A token goes into settings, is validated, and then save and load buttons appear in
the manage-saves popup, with an option to mirror every local save automatically.

## Summary

| Item | Decision |
|---|---|
| Backend | GitHub Gist, one secret gist per install |
| File per slot | `level13-<slot>.txt` inside that one gist |
| Token type | Fine-grained PAT, account permission **Gists: read and write** |
| Validation | Creates the save gist on the spot |
| Auto-mirror | Opt-in, off by default, fires only after a successful local save |
| Load auth | None — a secret gist is readable by id |

## Why not Pastebin

The original request named Pastebin. It cannot work from a browser. Measured, not assumed:

| Probe | Result |
|---|---|
| `POST api_post.php` with an `Origin` header | responds, but sends no `Access-Control-Allow-Origin` |
| The same request from the running game | `TypeError: Failed to fetch` |
| `pastebin.com/raw/…` | no CORS headers either |
| `api.github.com`, same probe | `access-control-allow-origin: *` |

Worse than a clean failure: a save POST is a "simple" request, so it reaches Pastebin and
creates the paste, but the browser blocks the game from reading the response — and the
response carries the paste key. Pastes would pile up that the game could never load back.
Level13 is a static site with no server of ours to proxy through.

## Token reality

Fine-grained tokens do support gists, through an **account** permission named `Gists`.
Documented as working with `write`: `POST /gists`, `PATCH /gists/{id}`, `DELETE /gists/{id}`.
No read endpoint is documented, and reading your own gists with a fine-grained token has a
[known bug](https://github.com/cli/cli/issues/7803).

This does not block loading, because a "secret" gist is **unlisted, not private** — anyone
holding the id can read it with no token. So:

- **Save** — `POST` / `PATCH` with the token.
- **Load** — plain `GET /gists/{id}`, unauthenticated.

Validation therefore must not use `GET /gists`. It exercises the permission we actually
need, by creating the gist.

## Components

### Storage (`localStorage`)

| Key | Holds |
|---|---|
| `github-token` | the fine-grained PAT |
| `github-gist-id` | the id of this install's save gist |
| `github-auto-mirror` | `"true"` / `"false"` |

Deliberately NOT in the save file. A save is exported, pasted into forums and mirrored to
the gist itself; a token inside it would travel with it.

### Gist layout

One secret gist, description `Level 13 saves`. One file per slot, named
`level13-<slotID>.txt`, holding the same LZ-compressed string that goes into `localStorage`.
Slot ids come from `GameConstants`: `default`, `user1`, `user2`, `user3`. The internal
`backup` and `loaded` slots are not mirrored.

### Settings — a "Cloud saves" section

- A token field, `type="password"`.
- **Save and validate** — creates the gist, stores the id, writes the status line.
- A status line: `Not set up`, `Connected`, or the actual error text from the API.
- **How do I get a token?** — opens the setup dialog.
- **Mirror every save automatically** — a checkbox, disabled until validation succeeds,
  off by default. It sends data off the machine, so it must be a deliberate act.

### Setup dialog (`#github-setup-popup`)

Numbered steps, and a link to `https://github.com/settings/personal-access-tokens/new`:

1. Open GitHub → your profile picture → **Settings**.
2. In the left sidebar, **Developer settings**.
3. Under Personal access tokens, **Fine-grained tokens**, then **Generate new token**.
4. Name it, for example `level13 saves`.
5. Set an **Expiration**. When it expires, saving stops working until you make a new one.
6. **Resource owner**: your own account.
7. Under **Permissions → Account permissions → Gists**, set access to **Read and write**.
8. **Generate token**, then copy it. GitHub shows it once and never again.
9. Paste it into the token field in settings and press **Save and validate**.

The dialog also states plainly: the save is stored in a *secret* gist, which is unlisted
rather than private — anyone with the link can read it. It is a compressed game state and
holds nothing personal, but it is not protected.

### Manage saves popup

Two buttons beside the existing Save / Load / Export for the selected slot:
**Save to GitHub** and **Load from GitHub**. Hidden entirely until a token is validated, so
the popup is unchanged for anyone not using this.

### Auto-mirror

The hook point is exact: in `SaveSystem.save`, immediately after

```js
let data = this.getCompressedSaveJSON();
let success = this.saveDataToSlot(slotID, data);
```

fire the mirror only when `success` is true. Both the slot id and the compressed string are
already in hand there, so nothing is re-serialised, and a network call can never sit
between the game state and the local write. Rules:

- At most one push per slot per 10 seconds, coalescing. Autosave runs every 2 minutes
  (`SaveSystem.autoSaveFrequency`), so this only bites on rapid manual saves.
- Fire and forget. A failure never blocks gameplay, never retries in a loop, and never
  touches the local save. It updates the settings status line.
- Manual slots only.

### Load

`GET /gists/{id}` with no auth, then take the file for the slot. If the API marks the file
`truncated` (over 1 MB), fetch its `raw_url` instead — today's save is 36 KB, but the
branch should exist before it is needed rather than after.

Before overwriting, a confirmation showing the gist's `updated_at` against the local slot's
timestamp, so loading an older cloud save over a newer local one is a choice.

## Risks

- **The token is in `localStorage`**, readable by any script on the page. Acceptable for a
  single-player game on your own Pages site; stated so it is a choice.
- **A secret gist is unlisted, not private.**
- **Token expiry breaks saving silently.** The status line is the only signal, which is why
  the auto-mirror writes its failures there.
- **Rate limit** is 5,000/hour authenticated against roughly 30 autosaves — ample.
- **A revoked or wrong-permission token** must fail loudly at validation, not at the first
  save, which is what creating the gist during validation buys.

## Out of scope

Encrypting the save. Conflict merging beyond the timestamp confirmation. Syncing settings
or anything other than save slots. Any non-gist backend.

## Verification

No test framework exists, so verification is browser-driven on a fresh port. The token must
be supplied by the user — it is never to be typed by the assistant, and never committed.
Where a real token is not available, the fetch layer is stubbed and the stub's calls
asserted.

1. With no token: no cloud buttons in manage saves, auto-mirror checkbox disabled.
2. An invalid token fails validation with the API's own message, and stores nothing.
3. A valid token creates the gist, stores the id, and flips the status to connected.
4. Save to GitHub writes the slot's file; a second save updates rather than duplicating.
5. Load from GitHub restores the slot, after the timestamp confirmation.
6. Auto-mirror pushes after an autosave, and never more than once per slot per 10 s.
7. A failing network leaves the local save intact and the game playable.
8. The token never appears in an exported save.
