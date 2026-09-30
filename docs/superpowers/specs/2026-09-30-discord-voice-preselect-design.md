# Discord voice pre-selection — design

**Date:** 2026-09-30
**Status:** approved 2026-09-30 (≥ 4 threshold added while planning)
**Repos:** `cod-teams` (this repo) and `server-configs` (Discord bot + Caddy)

## Goal

When someone opens qmg.rolf.bible during a session, "Selecteer spelers" is already
ticked for exactly the players who are in a voice channel on the QuickMaths Discord
server. A "Sync met Discord" button re-applies the current voice members on demand.

Success: open the page mid-session and the right people are selected without clicking.

## Decisions

| Question | Decision |
|---|---|
| When to pre-select | On page load, plus a "Sync met Discord" button. No background polling; manual edits are never overridden except by pressing the button. |
| Discord user → player | `discord_id` column on the Supabase `players` table. IDs are stable across Discord renames. |
| Data flow | Bot serves a token-protected HTTP endpoint; the cod-teams Express server proxies it at `/api/voice-members`. |

## Architecture

```
Discord gateway ──voice_states──▶ discord-bot (game-server, Docker)
                                    aiohttp :8080  GET /voice-members  (Bearer VOICE_API_TOKEN)
                                        ▲
                     Caddy (nginx_default network)  /api/voice-members → discord-bot:8080
                                        ▲  https://knoeks.rolf.bible/api/voice-members
                                        │
                     cod-teams-server (qmg box)  GET /api/voice-members → {discordIds}
                                        ▲
                     Browser (qmg.rolf.bible)  playersInVoice(players, discordIds)
```

## Part 1 — Discord bot (`server-configs/discord-bot`)

- `bot.py` starts an `aiohttp.web` server on `0.0.0.0:8080` from `setup_hook`, on the
  bot's event loop. `aiohttp` is already a dependency.
- `GET /voice-members`:
  - Requires `Authorization: Bearer <VOICE_API_TOKEN>`; otherwise **401**. The
    comparison uses `hmac.compare_digest`. If `VOICE_API_TOKEN` is unset, the web
    server is not started at all (fail closed).
  - Returns **503** until the bot's `on_ready` has fired (cache not yet populated), so
    "no data" is never mistaken for "nobody in voice".
  - Otherwise **200**:
    `{"members": [{"id": "<snowflake as string>", "display_name": "...", "channel": "..."}]}`
    covering every voice/stage channel in every guild the bot is in, excluding bots.
    Served from discord.py's voice-state cache; no Discord API calls per request.
- Pure helper `voice_members(guilds) -> list[dict]` holds the extraction logic so it can
  be unit-tested with fake guild/channel/member objects.
- Intents: unchanged. `Intents.default()` already includes `voice_states`; GUILD_CREATE
  includes voice-connected members even without the privileged members intent. Server
  Members Intent was enabled only temporarily to collect IDs and must be off again.
- Secrets: `docker-compose.yml` switches to `env_file: .env`; `DISCORD_TOKEN`,
  `CHANNEL_ID`, `DOMAIN` and the new `VOICE_API_TOKEN` live in a gitignored
  `discord-bot/.env`, with a committed `discord-bot/.env.example`. `deploy.sh` copies
  `.env.example` (never `.env`). The bot token currently in git history should be
  reset in the Discord Developer Portal (Rolf).
- Caddy: add to both `nginx/Caddyfile.example` and the live `/opt/stacks/nginx/Caddyfile`,
  before the catch-all `handle`:
  ```
  handle /api/voice-members {
      rewrite * /voice-members
      reverse_proxy discord-bot:8080
  }
  ```
- Tests: `discord-bot/test_bot.py` (unittest, like `nginx/test_index.py`) for
  `voice_members()` and the handler's 401 / 503 / 200 paths.

## Part 2 — cod-teams

### Database

`supabase-add-discord-ids.sql` (run once in the Supabase SQL editor by Rolf):

```sql
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS discord_id TEXT UNIQUE;
```

plus one `UPDATE` per player. `supabase-migration.sql` gets the column too, so a fresh
database matches.

| Player | Discord ID | Discord name |
|---|---|---|
| Arjan | 707336978068275341 | arjan980 |
| Frank | 381801709539688448 | frank4103 |
| Guido | 312220239653896193 | guido_68 |
| Jan-Joost | 381812737874984970 | getJayked |
| Joel | 395547130393133056 | Joey (joeloffermans) |
| Kevin | 340500831973670913 | Glow |
| Lennard | 381818898506579969 | Lennard (Aegys) |
| Maarten | 440477861099470849 | D3labottle. |
| Rick | 385506883479535616 | Rick (deSperadO) |
| Rolf | 364542389353709570 | Rolf (.hydrax1) |
| Scott | 684951231357124638 | ScottyPhil |
| Thomas | 706461150572970025 | W33m4n |

### Storage

`Player` in `src/storage.ts` gains `discordId?: string`, filled from `row.discord_id`.
The localStorage fallback carries no IDs, so sync finds no matches there and the
default selection stays. `savePlayers` (currently uncalled) deletes every row and
re-inserts, so it must write `discord_id: player.discordId ?? null` too — otherwise any
future caller would silently wipe the mapping.

### Server (`server/index.js`)

- `GET /api/voice-members`, no auth (voice presence is intended to be visible to anyone
  who can open the page, like match history), covered by the existing per-IP rate limit.
- Calls `VOICE_API_URL` (default `https://knoeks.rolf.bible/api/voice-members`) with
  `Authorization: Bearer ${VOICE_API_TOKEN}` and a 5 s timeout (`AbortSignal.timeout`).
- Responds `{"discordIds": ["..."]}` — display names and channel names are stripped.
- Bot unreachable, non-200, or timeout → **502** `{"error": "..."}`.
  `VOICE_API_TOKEN` unset → **503**; the server still boots (the feature is optional,
  unlike `ANTHROPIC_API_KEY`).
- New keys documented in a new `server/.env.example` (none exists today), alongside the
  existing `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PORT`.

### Frontend

- `src/discordVoice.ts`:
  - `playersInVoice(players: {name: string; discordId?: string}[], discordIds: string[]): string[]`
    — names of players whose `discordId` is in the list, in `players` order. Pure,
    tested in `src/discordVoice.test.ts`.
  - `fetchVoiceDiscordIds(): Promise<string[]>` — `GET /api/voice-members`, throws on
    non-2xx.
- `App.tsx`:
  - Keep each player's `discordId` alongside `playerStats`.
  - After players load: fetch; if `playersInVoice` returns ≥ 4 names (the app's
    existing minimum — `onActivePlayersChange` rejects any selection below 4, so a
    1–3 player selection would lock the checkboxes), `setActivePlayers` to exactly
    that list; otherwise keep today's default (all minus `RARELY_PRESENT_PLAYERS`).
    The load-time result is dropped if the user already changed the selection.
    Errors on load are silent (`console.warn`).
  - "Sync met Discord" button beside the "Selecteer spelers" heading, same logic, with
    an inline status: `"N spelers in voice"` (applied), `"Maar N in voice — selectie
    niet aangepast"` (1–3), `"Niemand in voice"`, or `"Discord niet bereikbaar"`.
  - Existing 500 ms debounce on `activePlayers` stays; no other behaviour changes.

## Data safety (Supabase)

Requirement from Rolf: no Supabase data may be lost.

- The feature itself never writes to Supabase; the only write is the one-off migration.
- The migration is additive (`ADD COLUMN IF NOT EXISTS`, `UPDATE … SET discord_id`
  guarded by `discord_id IS NULL`), wrapped in `BEGIN`/`COMMIT` so it is all-or-nothing,
  and a no-op when re-run. No `DELETE`, `DROP`, or change to any other column.
- Before running it: `node scripts/backup-supabase.mjs` saves a read-only JSON snapshot
  of all four tables (`players`, `player_ratings`, `match_history`, `settings`).
- After running it: `node scripts/backup-supabase.mjs --compare <snapshot>` must report
  no problems — the only permitted difference is `players.discord_id` going from null to
  a value — and `node scripts/verify-ratings.mjs` must still show zero drift.
- `supabase-migration.sql` starts with `DROP TABLE … CASCADE` and must never be run
  against the live database; its edit here only keeps fresh installs in sync.
- `savePlayers` (delete-all + re-insert, currently uncalled) carries `discord_id`.

## Rollout

Each step is safe on its own — until the chain is complete the page keeps its default.

1. server-configs: bot endpoint, `.env`, Caddy route; `./deploy.sh discord-bot nginx`,
   rebuild `discord-bot`, reload Caddy.
2. Supabase: Rolf runs `supabase-add-discord-ids.sql`.
3. cod-teams: Rolf adds `VOICE_API_URL` / `VOICE_API_TOKEN` to `server/.env` on the qmg
   box; merge → auto-deploy; `sudo systemctl restart cod-teams-server` if the deploy
   script did not.

## Verification

- Unit: `python3 -m unittest` in `discord-bot/`; `npm test` in cod-teams.
- Bot + Caddy on game-server:
  `curl -H 'Host: knoeks.rolf.bible' localhost/api/voice-members` → 401;
  with the Bearer token → 200 JSON (the Host header is required — a bare localhost
  request hits no site block and returns an empty 200).
- End to end: someone joins voice, load qmg.rolf.bible in a real browser, confirm the
  selection and the sync button's status text.

## Git

Feature branch + draft PR in each repo (`discord-voice-preselect`); Rolf merges.
Pushing cod-teams `main` auto-deploys production, so no direct pushes to `main`.

## Out of scope

Live polling, per-channel filtering, editing Discord IDs from the UI.
