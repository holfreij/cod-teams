# Discord Voice Pre-selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** qmg.rolf.bible pre-selects the players who are in a QuickMaths Discord voice channel on page load, with a "Sync met Discord" button to re-apply it.

**Architecture:** The Discord bot (server-configs, on `game-server`) serves a token-protected `GET /voice-members` from discord.py's voice-state cache, published by Caddy at `https://knoeks.rolf.bible/api/voice-members`. The cod-teams Express server proxies it at `/api/voice-members`, reduced to Discord user IDs. The frontend maps IDs to players through a new `players.discord_id` column.

**Tech Stack:** Python 3.11 + discord.py 2.7 + aiohttp 3.13 (bot); Caddy; Node 22 + Express 4 (cod-teams server); React 18 + TypeScript 5.6 + Chakra UI 3 + vitest 4 (frontend); Supabase Postgres.

**Spec:** `docs/superpowers/specs/2026-09-30-discord-voice-preselect-design.md` (this repo)

**Where work happens:** everything is implemented on `game-server`. Tasks 1–2 in a
worktree of `/home/rolf/server-configs` on branch `discord-voice-preselect`; Tasks 3–6
in `/home/rolf/cod-teams` on branch `discord-voice-preselect` (already exists, holds the
spec). Task 7 is the rollout. Production cod-teams deploys itself on the qmg box when
`main` moves (its `deploy.sh`).

**Running tests on game-server** (no Node or bot deps on the host):
- Bot: `docker run --rm -v "$PWD/discord-bot:/src" -w /src discord-bot-discord-bot:latest python -m unittest -v` (run from the server-configs worktree root; the image already has discord.py + aiohttp).
- cod-teams: `docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v /home/rolf/cod-teams:/app -w /app node:22 sh -c 'npm ci --no-audit --no-fund && npm test'`. After the first `npm ci`, later runs can use `npm test` alone. Same pattern for `npm run lint` and `npm run build`.

## Global Constraints

- **No Supabase data may be lost.** The feature code never writes to Supabase. The only write is the migration in Task 3, run once by Rolf, only after a snapshot, and followed by a compare that must come back clean.
- Never run `supabase-migration.sql` against the live database; it starts with `DROP TABLE … CASCADE`.
- UI text is Dutch. Exact strings: `🎧 Sync met Discord`, `N spelers in voice` (only shown for N ≥ 4), `Maar N in voice — selectie niet aangepast`, `Niemand in voice`, `Discord niet bereikbaar`.
- Voice sync only changes the selection when ≥ 4 mapped players are in voice (the minimum `onActivePlayersChange` enforces).
- Bot endpoint: `GET /voice-members` on port 8080, header `Authorization: Bearer <VOICE_API_TOKEN>`, 401 bad or missing token, 503 before `on_ready`, 200 `{"members": [{"id", "display_name", "channel"}]}` with bots excluded. If `VOICE_API_TOKEN` is unset the web server does not start.
- cod-teams endpoint: `GET /api/voice-members` returns `{"discordIds": [...]}`; 502 when the bot fails, 503 when `VOICE_API_TOKEN` is unset. Timeout 5 s. Covered by the existing per-IP rate limit.
- Secrets never get committed: `discord-bot/.env`, `cod-teams/.env`, and `cod-teams/server/.env` are gitignored. Commit `.env.example` files instead.
- No pushes to `main` in either repo: feature branch + draft PR, Rolf merges.

## Review Focus

1. **The user clicks before the load-time fetch returns.** Their manual selection must not be overwritten when the response arrives. Pinned in Task 6 (`shouldApplyLoadResult`).
2. **Bot slow, down, or not ready yet.** The page keeps its default within about 5 s and the button shows `Discord niet bereikbaar`. It must never hang or throw. Pinned in Task 2 (503 before ready), Task 5 (timeout → 502), and Task 6 (fetch rejects → status text).
3. **People in voice who aren't mapped** (guests, bots, someone in two guilds). They are ignored, and duplicates collapse. Pinned in Task 1 (bots excluded), Task 5 (dedupe), and Task 6 (unknown IDs dropped).
4. **The migration is re-run, or fails halfway.** Either way, no existing data may change. Pinned by the transactional, guarded SQL and the snapshot compare in Task 3 (`diffSnapshots` flags any change except null → value on `players.discord_id`).
5. **Missing or wrong token.** It returns 401 with an empty body and leaks no member data. An empty `VOICE_API_TOKEN` must not mean "no auth". Pinned in Task 1 (401 tests) and Task 2 (the server doesn't start without a token).

---

## File Structure

**server-configs**
- Create `discord-bot/voice_api.py`: `voice_members(guilds)` plus the aiohttp app factory. No discord import, so it can be tested with fakes.
- Create `discord-bot/test_voice_api.py`: unittest suite.
- Modify `discord-bot/bot.py`: start the web server in `setup_hook`.
- Modify `discord-bot/Dockerfile`: `COPY voice_api.py`.
- Modify `discord-bot/docker-compose.yml`: move to `env_file: .env`.
- Create `discord-bot/.env.example`.
- Modify `deploy.sh`: copy `voice_api.py` and `.env.example`.
- Modify `nginx/Caddyfile.example`: add the `/api/voice-members` route.
- Modify `README.md`: bot description and test command.

**cod-teams**
- Create `scripts/snapshot-diff.mjs`: pure `diffSnapshots(before, after)`.
- Create `scripts/snapshot-diff.test.mjs`
- Create `scripts/backup-supabase.mjs`: read-only snapshot and `--compare`.
- Create `supabase-add-discord-ids.sql`
- Modify `supabase-migration.sql`: add the column to `CREATE TABLE players`.
- Modify `.gitignore`: `supabase-backups/`.
- Create `src/playerRows.ts`: `rowToPlayer`, `playerToRow`.
- Create `src/playerRows.test.ts`
- Modify `src/storage.ts`: use `playerRows`, and add `discordId` to `Player`.
- Create `server/voiceMembers.js`: `fetchVoiceDiscordIds`, `voiceMembersHandler`.
- Create `server/voiceMembers.test.js`
- Modify `server/index.js`: register the route.
- Create `server/.env.example`
- Create `src/discordVoice.ts`: `playersInVoice`, `voiceSyncOutcome`, `shouldApplyLoadResult`, `fetchVoiceDiscordIds`.
- Create `src/discordVoice.test.ts`
- Modify `src/App.tsx`: load-time sync, the button, and the status line.
- Modify `claude.md`: document the feature.

---

### Task 1: Bot voice API module (server-configs)

**Files:**
- Create: `discord-bot/voice_api.py`
- Test: `discord-bot/test_voice_api.py`

**Interfaces:**
- Produces:
  - `voice_members(guilds) -> list[dict]`. Each guild has `.voice_channels` and `.stage_channels`, each channel has `.name` and `.members`, and each member has `.id`, `.display_name` and `.bot`. Returns `[{"id": str, "display_name": str, "channel": str}]`.
  - `make_app(*, token: str, get_guilds: Callable[[], Iterable], is_ready: Callable[[], bool]) -> aiohttp.web.Application`. It serves `GET /voice-members`.
  - `async start_voice_api(app, port: int = 8080) -> aiohttp.web.AppRunner`

- [ ] **Step 1: Enter an isolated worktree of server-configs**

Use the EnterWorktree tool with name `discord-voice-preselect`. All Task 1–2 paths are relative to that worktree root.

- [ ] **Step 2: Write the failing tests**

`discord-bot/test_voice_api.py`:

```python
"""Tests for the bot's voice-member HTTP endpoint.

Run inside the bot image (the host has no discord.py/aiohttp):
  docker run --rm -v "$PWD/discord-bot:/src" -w /src discord-bot-discord-bot:latest python -m unittest -v
"""
import unittest
from types import SimpleNamespace as NS

from aiohttp.test_utils import AioHTTPTestCase

from voice_api import make_app, voice_members

TOKEN = "s3cret"


def member(id_, name, bot=False):
    return NS(id=id_, display_name=name, bot=bot)


def guild(voice=(), stage=()):
    return NS(voice_channels=list(voice), stage_channels=list(stage))


def channel(name, members):
    return NS(name=name, members=list(members))


class VoiceMembersTest(unittest.TestCase):
    def test_lists_members_of_every_voice_and_stage_channel(self):
        g = guild(
            voice=[channel("Gaming", [member(1, "Glow")]), channel("AFK", [member(2, "Rolf")])],
            stage=[channel("Podium", [member(3, "Joey")])],
        )
        self.assertEqual(voice_members([g]), [
            {"id": "1", "display_name": "Glow", "channel": "Gaming"},
            {"id": "2", "display_name": "Rolf", "channel": "AFK"},
            {"id": "3", "display_name": "Joey", "channel": "Podium"},
        ])

    def test_excludes_bots(self):
        g = guild(voice=[channel("Gaming", [member(1, "Glow"), member(9, "MusicBot", bot=True)])])
        self.assertEqual([m["id"] for m in voice_members([g])], ["1"])

    def test_ids_are_strings(self):
        # Discord snowflakes exceed JS Number precision; the browser must get strings.
        g = guild(voice=[channel("Gaming", [member(364542389353709570, "Rolf")])])
        self.assertEqual(voice_members([g])[0]["id"], "364542389353709570")

    def test_empty_when_nobody_in_voice(self):
        self.assertEqual(voice_members([guild(voice=[channel("Gaming", [])])]), [])


class VoiceApiTest(AioHTTPTestCase):
    ready = True

    async def get_application(self):
        g = guild(voice=[channel("Gaming", [member(1, "Glow")])])
        return make_app(token=TOKEN, get_guilds=lambda: [g], is_ready=lambda: self.ready)

    async def test_rejects_missing_token(self):
        resp = await self.client.get("/voice-members")
        self.assertEqual(resp.status, 401)
        self.assertNotIn("Glow", await resp.text())

    async def test_rejects_wrong_token(self):
        resp = await self.client.get("/voice-members", headers={"Authorization": "Bearer nope"})
        self.assertEqual(resp.status, 401)

    async def test_rejects_token_without_bearer_prefix(self):
        resp = await self.client.get("/voice-members", headers={"Authorization": TOKEN})
        self.assertEqual(resp.status, 401)

    async def test_503_before_ready(self):
        self.ready = False
        resp = await self.client.get("/voice-members", headers={"Authorization": f"Bearer {TOKEN}"})
        self.assertEqual(resp.status, 503)

    async def test_returns_members_with_valid_token(self):
        resp = await self.client.get("/voice-members", headers={"Authorization": f"Bearer {TOKEN}"})
        self.assertEqual(resp.status, 200)
        self.assertEqual(await resp.json(), {
            "members": [{"id": "1", "display_name": "Glow", "channel": "Gaming"}],
        })


class MakeAppTest(unittest.TestCase):
    def test_refuses_empty_token(self):
        with self.assertRaises(ValueError):
            make_app(token="", get_guilds=lambda: [], is_ready=lambda: True)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run the tests and check they fail**

Run: `docker run --rm -v "$PWD/discord-bot:/src" -w /src discord-bot-discord-bot:latest python -m unittest -v`
Expected: ERROR `ModuleNotFoundError: No module named 'voice_api'`

- [ ] **Step 4: Write the implementation**

`discord-bot/voice_api.py`:

```python
"""HTTP endpoint listing who is in a voice channel, for qmg.rolf.bible's team picker.

Kept free of discord imports so it can be tested with plain fakes; bot.py passes in
the guild list and readiness from the live client.
"""
import hmac

from aiohttp import web


def voice_members(guilds):
    """Humans currently in any voice or stage channel, from the gateway cache."""
    members = []
    for guild in guilds:
        for channel in [*guild.voice_channels, *guild.stage_channels]:
            for member in channel.members:
                if member.bot:
                    continue
                members.append({
                    "id": str(member.id),
                    "display_name": member.display_name,
                    "channel": channel.name,
                })
    return members


def make_app(*, token, get_guilds, is_ready):
    if not token:
        # An empty token would make "Bearer " a valid credential.
        raise ValueError("VOICE_API_TOKEN must be set")
    expected = f"Bearer {token}".encode()

    async def handle_voice_members(request):
        supplied = request.headers.get("Authorization", "").encode()
        if not hmac.compare_digest(supplied, expected):
            return web.json_response({"error": "unauthorized"}, status=401)
        if not is_ready():
            # Cache not populated yet: "unknown", not "nobody in voice".
            return web.json_response({"error": "not ready"}, status=503)
        return web.json_response({"members": voice_members(get_guilds())})

    app = web.Application()
    app.router.add_get("/voice-members", handle_voice_members)
    return app


async def start_voice_api(app, port=8080):
    runner = web.AppRunner(app)
    await runner.setup()
    await web.TCPSite(runner, "0.0.0.0", port).start()
    return runner
```

- [ ] **Step 5: Run the tests and check they pass**

Run: `docker run --rm -v "$PWD/discord-bot:/src" -w /src discord-bot-discord-bot:latest python -m unittest -v`
Expected: 10 tests, `OK`

- [ ] **Step 6: Commit**

```bash
git add discord-bot/voice_api.py discord-bot/test_voice_api.py
git commit -m "Add voice-member HTTP endpoint module for the Discord bot"
```

---

### Task 2: Wire the endpoint into the bot, move secrets to .env, add the Caddy route (server-configs)

**Files:**
- Modify: `discord-bot/bot.py:1-18` (imports, env, setup_hook)
- Modify: `discord-bot/Dockerfile`
- Modify: `discord-bot/docker-compose.yml`
- Create: `discord-bot/.env.example`
- Modify: `deploy.sh` (the `"discord-bot")` case)
- Modify: `nginx/Caddyfile.example`
- Modify: `README.md` (discord-bot line ~20, test commands ~501)

**Interfaces:**
- Consumes: `make_app(token=, get_guilds=, is_ready=)`, `start_voice_api(app, port)` from Task 1.
- Produces: `https://knoeks.rolf.bible/api/voice-members` (Bearer `VOICE_API_TOKEN`), which Task 5 calls.

- [ ] **Step 1: Wire into `bot.py`**

Add to the imports at the top:

```python
from voice_api import make_app, start_voice_api
```

After the `NOTIFIED_FILE = ...` line, add:

```python
VOICE_API_TOKEN = os.environ.get('VOICE_API_TOKEN', '')
```

Directly after `bot = commands.Bot(command_prefix='!', intents=intents)`, add:

```python
async def setup_hook():
    """Serve /voice-members for qmg.rolf.bible's player pre-selection."""
    if not VOICE_API_TOKEN:
        print("VOICE_API_TOKEN not set; voice-members endpoint disabled")
        return
    app = make_app(token=VOICE_API_TOKEN, get_guilds=lambda: bot.guilds, is_ready=bot.is_ready)
    await start_voice_api(app, port=8080)
    print("Voice-members endpoint listening on :8080")

bot.setup_hook = setup_hook
```

- [ ] **Step 2: Ship the module in the image**

`discord-bot/Dockerfile`: replace `COPY bot.py .` with:

```dockerfile
COPY bot.py voice_api.py ./
```

- [ ] **Step 3: Move secrets to `.env`**

`discord-bot/docker-compose.yml`: replace the whole `environment:` block (4 lines) with:

```yaml
    env_file: .env
```

Create `discord-bot/.env.example`:

```bash
# Copy to .env (gitignored) next to docker-compose.yml.
# Bot token: Discord Developer Portal -> Applications -> the bot -> Bot -> Reset Token
DISCORD_TOKEN=your-bot-token
# Channel for update notifications
CHANNEL_ID=1468322220035018884
DOMAIN=knoeks.rolf.bible
# Shared secret for GET /voice-members (qmg.rolf.bible's cod-teams server sends it).
# Generate with: openssl rand -hex 32
VOICE_API_TOKEN=generate-me
```

Check that `.env` is ignored: `git check-ignore -v discord-bot/.env`. Expected output: `.gitignore:2:*.env	discord-bot/.env`

- [ ] **Step 4: Have `deploy.sh` copy the new files**

In the `"discord-bot")` case, after the `bot.py` line, add:

```bash
            [[ -f "$src/voice_api.py" ]] && cp "$src/voice_api.py" "$dest/"
            [[ -f "$src/.env.example" ]] && cp "$src/.env.example" "$dest/"
```

- [ ] **Step 5: Caddy route**

In `nginx/Caddyfile.example`, directly before `handle_path /downloads/* {`, add:

```
    # Who is in Discord voice, for qmg.rolf.bible's player pre-selection.
    # Protected by the bot's own Bearer token (VOICE_API_TOKEN), not basic auth.
    handle /api/voice-members {
        rewrite * /voice-members
        reverse_proxy discord-bot:8080
    }
```

- [ ] **Step 6: README**

In `README.md`, change the discord-bot line to:

```markdown
- **discord-bot** - Discord integration for update notifications, the `!ip` command, and `/api/voice-members` (who is in voice, used by qmg.rolf.bible to pre-select players; secrets in `discord-bot/.env`, see `.env.example`)
```

Next to the other test commands (~line 501), add:

```bash
docker run --rm -v "$PWD/discord-bot:/src" -w /src discord-bot-discord-bot:latest python -m unittest -v  # bot voice API
```

- [ ] **Step 7: Check the bot still imports**

Run: `docker run --rm -v "$PWD/discord-bot:/src" -w /src discord-bot-discord-bot:latest python -c "import ast,sys; ast.parse(open('bot.py').read()); import voice_api; print('ok')"`
Expected: `ok`

Run the full suite again. Expected: 10 tests `OK`.

- [ ] **Step 8: Commit and push**

```bash
git add discord-bot/bot.py discord-bot/Dockerfile discord-bot/docker-compose.yml discord-bot/.env.example deploy.sh nginx/Caddyfile.example README.md
git commit -m "Serve Discord voice members for qmg team pre-selection; move bot secrets to .env"
git push -u origin discord-voice-preselect
```

Open a draft PR: `gh pr create --draft --title "Discord bot: voice-members endpoint for qmg pre-selection" --body "..."`. The body links the cod-teams spec, and says the bot token from git history should be reset. Deploying is Task 7.

---

### Task 3: Supabase safety net and migration (cod-teams)

**Files:**
- Create: `scripts/snapshot-diff.mjs`
- Test: `scripts/snapshot-diff.test.mjs`
- Create: `scripts/backup-supabase.mjs`
- Create: `supabase-add-discord-ids.sql`
- Modify: `supabase-migration.sql` (`CREATE TABLE public.players`, ~line 29)
- Modify: `.gitignore`

**Interfaces:**
- Produces:
  - `TABLES`, which maps each table to its primary key: `{players: "name", player_ratings: "name", match_history: "id", settings: "key"}`
  - `diffSnapshots(before, after) -> {problems: string[], allowed: string[]}`. Both snapshots have the shape `{tables: {[table]: row[]}}`.

All commands in Tasks 3–6 run from `/home/rolf/cod-teams`, on branch `discord-voice-preselect`.

- [ ] **Step 1: Write the failing test**

`scripts/snapshot-diff.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { diffSnapshots } from "./snapshot-diff.mjs";

const snap = (overrides = {}) => ({
  tables: {
    players: [
      { name: "Kevin", initial_elo: 1500 },
      { name: "Rolf", initial_elo: 1500 },
    ],
    player_ratings: [{ name: "Kevin", rating: 1600, wins: 3 }],
    match_history: [{ id: "m1", team1_score: 10, rating_changes: { Kevin: 12 } }],
    settings: [{ key: "uneven_team_coefficient", value: 1500 }],
    ...overrides,
  },
});

describe("diffSnapshots", () => {
  it("reports nothing for identical snapshots", () => {
    expect(diffSnapshots(snap(), snap())).toEqual({ problems: [], allowed: [] });
  });

  it("allows discord_id going from absent to a value", () => {
    const after = snap({
      players: [
        { name: "Kevin", initial_elo: 1500, discord_id: "340500831973670913" },
        { name: "Rolf", initial_elo: 1500, discord_id: null },
      ],
    });
    const result = diffSnapshots(snap(), after);
    expect(result.problems).toEqual([]);
    expect(result.allowed).toEqual(["players Kevin: discord_id set to 340500831973670913"]);
  });

  it("flags a discord_id that is changed or cleared", () => {
    const before = snap({ players: [{ name: "Kevin", initial_elo: 1500, discord_id: "1" }] });
    const changed = snap({ players: [{ name: "Kevin", initial_elo: 1500, discord_id: "2" }] });
    const cleared = snap({ players: [{ name: "Kevin", initial_elo: 1500, discord_id: null }] });
    expect(diffSnapshots(before, changed).problems).toHaveLength(1);
    expect(diffSnapshots(before, cleared).problems).toHaveLength(1);
  });

  it("flags a missing row in any table", () => {
    const after = snap({ match_history: [] });
    expect(diffSnapshots(snap(), after).problems).toEqual(["match_history m1: row missing"]);
  });

  it("flags a changed value in a non-discord column", () => {
    const after = snap({ player_ratings: [{ name: "Kevin", rating: 1500, wins: 3 }] });
    expect(diffSnapshots(snap(), after).problems).toEqual([
      "player_ratings Kevin: rating changed 1600 -> 1500",
    ]);
  });

  it("compares JSON columns by value, not identity", () => {
    const after = snap({ match_history: [{ id: "m1", team1_score: 10, rating_changes: { Kevin: 12 } }] });
    expect(diffSnapshots(snap(), after).problems).toEqual([]);
  });

  it("flags added rows so a match recorded mid-migration gets noticed", () => {
    const after = snap({ settings: [...snap().tables.settings, { key: "x", value: 1 }] });
    expect(diffSnapshots(snap(), after).problems).toEqual(["settings x: row added"]);
  });

  it("flags a table that is missing from the new snapshot", () => {
    const after = { tables: { ...snap().tables } };
    delete after.tables.settings;
    expect(diffSnapshots(snap(), after).problems).toEqual(["settings: table missing"]);
  });
});
```

- [ ] **Step 2: Run the test and check it fails**

Run: `docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v /home/rolf/cod-teams:/app -w /app node:22 sh -c 'npm ci --no-audit --no-fund && npx vitest run scripts/snapshot-diff.test.mjs'`
Expected: FAIL `Failed to load url ./snapshot-diff.mjs`

- [ ] **Step 3: Write the diff implementation**

`scripts/snapshot-diff.mjs`:

```js
// Compares two Supabase snapshots (see backup-supabase.mjs). The only change the
// Discord-ID migration may make is players.discord_id going from null to a value;
// everything else is reported as a problem.

export const TABLES = {
  players: "name",
  player_ratings: "name",
  match_history: "id",
  settings: "key",
};

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function diffSnapshots(before, after) {
  const problems = [];
  const allowed = [];

  for (const [table, key] of Object.entries(TABLES)) {
    const oldRows = before.tables[table] ?? [];
    const newRows = after.tables[table];
    if (!newRows) {
      problems.push(`${table}: table missing`);
      continue;
    }
    const newByKey = new Map(newRows.map((r) => [r[key], r]));
    const oldKeys = new Set(oldRows.map((r) => r[key]));

    for (const oldRow of oldRows) {
      const id = oldRow[key];
      const newRow = newByKey.get(id);
      if (!newRow) {
        problems.push(`${table} ${id}: row missing`);
        continue;
      }
      for (const col of new Set([...Object.keys(oldRow), ...Object.keys(newRow)])) {
        if (same(oldRow[col], newRow[col])) continue;
        if (table === "players" && col === "discord_id" && oldRow[col] == null) {
          allowed.push(`players ${id}: discord_id set to ${newRow[col]}`);
          continue;
        }
        problems.push(
          `${table} ${id}: ${col} changed ${JSON.stringify(oldRow[col])} -> ${JSON.stringify(newRow[col])}`
        );
      }
    }
    for (const newRow of newRows) {
      if (!oldKeys.has(newRow[key])) problems.push(`${table} ${newRow[key]}: row added`);
    }
  }
  return { problems, allowed };
}
```

- [ ] **Step 4: Run the test and check it passes**

Run: `docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v /home/rolf/cod-teams:/app -w /app node:22 npx vitest run scripts/snapshot-diff.test.mjs`
Expected: 8 passed

- [ ] **Step 5: Write the backup and compare CLI**

`scripts/backup-supabase.mjs`:

```js
// Read-only snapshot of every Supabase table, plus a post-migration check.
//   node scripts/backup-supabase.mjs                   -> supabase-backups/<timestamp>.json
//   node scripts/backup-supabase.mjs --compare <file>  -> diff live data against a snapshot
// Uses the public anon key from .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY);
// it can only read. Exit code 1 when --compare finds a problem.
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { TABLES, diffSnapshots } from "./snapshot-diff.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const headers = {
  apikey: env.VITE_SUPABASE_ANON_KEY,
  Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
};
const PAGE = 1000; // PostgREST's default max rows per request

async function fetchTable(table, key) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const url = `${env.VITE_SUPABASE_URL}/rest/v1/${table}?select=*&order=${key}.asc&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

async function snapshot() {
  const tables = {};
  for (const [table, key] of Object.entries(TABLES)) tables[table] = await fetchTable(table, key);
  return { takenAt: new Date().toISOString(), tables };
}

const current = await snapshot();
const counts = Object.entries(current.tables).map(([t, rows]) => `${t}: ${rows.length}`).join(", ");

const compareIdx = process.argv.indexOf("--compare");
if (compareIdx === -1) {
  const dir = join(root, "supabase-backups");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${current.takenAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(current, null, 2));
  console.log(`Snapshot written: ${file}\n${counts}`);
} else {
  const before = JSON.parse(readFileSync(process.argv[compareIdx + 1], "utf8"));
  const { problems, allowed } = diffSnapshots(before, current);
  console.log(`Live: ${counts}`);
  allowed.forEach((l) => console.log(`  ok       ${l}`));
  problems.forEach((l) => console.log(`  PROBLEM  ${l}`));
  console.log(problems.length ? `\n${problems.length} problem(s) - investigate before continuing.` : "\nNo data lost or changed.");
  process.exit(problems.length ? 1 : 0);
}
```

In `.gitignore`, after the `server/.env` line, add:

```
# Supabase snapshots from scripts/backup-supabase.mjs (contain all match data)
supabase-backups/
```

- [ ] **Step 6: Write the migration**

`supabase-add-discord-ids.sql`:

```sql
-- Incremental migration for the live database (run once in the Supabase SQL editor).
-- Adds each player's Discord user ID so qmg.rolf.bible can pre-select whoever is in
-- a Discord voice channel.
--
-- Additive only: no rows are deleted and no existing column changes. The transaction
-- makes it all-or-nothing, and the IS NULL guards make re-running it a no-op.
--   BEFORE: node scripts/backup-supabase.mjs
--   AFTER:  node scripts/backup-supabase.mjs --compare supabase-backups/<snapshot>.json
--           node scripts/verify-ratings.mjs

BEGIN;

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS discord_id TEXT UNIQUE;
COMMENT ON COLUMN public.players.discord_id IS 'Discord user ID (snowflake, as text) for voice-channel pre-selection';

UPDATE public.players SET discord_id = '707336978068275341' WHERE name = 'Arjan'     AND discord_id IS NULL;
UPDATE public.players SET discord_id = '381801709539688448' WHERE name = 'Frank'     AND discord_id IS NULL;
UPDATE public.players SET discord_id = '312220239653896193' WHERE name = 'Guido'     AND discord_id IS NULL;
UPDATE public.players SET discord_id = '381812737874984970' WHERE name = 'Jan-Joost' AND discord_id IS NULL;
UPDATE public.players SET discord_id = '395547130393133056' WHERE name = 'Joel'      AND discord_id IS NULL;
UPDATE public.players SET discord_id = '340500831973670913' WHERE name = 'Kevin'     AND discord_id IS NULL;
UPDATE public.players SET discord_id = '381818898506579969' WHERE name = 'Lennard'   AND discord_id IS NULL;
UPDATE public.players SET discord_id = '440477861099470849' WHERE name = 'Maarten'   AND discord_id IS NULL;
UPDATE public.players SET discord_id = '385506883479535616' WHERE name = 'Rick'      AND discord_id IS NULL;
UPDATE public.players SET discord_id = '364542389353709570' WHERE name = 'Rolf'      AND discord_id IS NULL;
UPDATE public.players SET discord_id = '684951231357124638' WHERE name = 'Scott'     AND discord_id IS NULL;
UPDATE public.players SET discord_id = '706461150572970025' WHERE name = 'Thomas'    AND discord_id IS NULL;

COMMIT;

-- Expect 12 rows, each with a discord_id.
SELECT name, discord_id FROM public.players ORDER BY name;
```

In `supabase-migration.sql`, add the column to the `CREATE TABLE public.players (...)` column list, directly after the `initial_elo` line:

```sql
  discord_id TEXT UNIQUE,
```

Check that the other columns are unchanged: `git diff supabase-migration.sql` should show exactly one added line.

- [ ] **Step 7: Run the full suite**

Run: `docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v /home/rolf/cod-teams:/app -w /app node:22 npm test`
Expected: all existing tests plus 8 new ones pass.

- [ ] **Step 8: Commit**

```bash
git add scripts/snapshot-diff.mjs scripts/snapshot-diff.test.mjs scripts/backup-supabase.mjs supabase-add-discord-ids.sql supabase-migration.sql .gitignore
git commit -m "Add discord_id migration with snapshot and compare safety net"
```

---

### Task 4: Carry `discordId` through player storage (cod-teams)

**Files:**
- Create: `src/playerRows.ts`
- Test: `src/playerRows.test.ts`
- Modify: `src/storage.ts:41-44` (`SupabasePlayerRow`), `:391-394` (`Player`), `:405-408` (`getPlayers` mapping), `:433-436` (`savePlayers` mapping)

**Interfaces:**
- Produces:
  - `interface PlayerRow { name: string; initial_elo: number; discord_id?: string | null }`
  - `interface Player { name: string; initialElo: number; discordId?: string }`. It moves into `playerRows.ts` and `storage.ts` re-exports it.
  - `rowToPlayer(row: PlayerRow): Player`
  - `playerToRow(p: Player): { name: string; initial_elo: number; discord_id: string | null }`
  - `getPlayers()` now returns `Player[]` with `discordId` filled in when set.

- [ ] **Step 1: Write the failing test**

`src/playerRows.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { playerToRow, rowToPlayer } from "./playerRows";

describe("rowToPlayer", () => {
  it("maps discord_id to discordId", () => {
    expect(rowToPlayer({ name: "Kevin", initial_elo: 1500, discord_id: "340500831973670913" }))
      .toEqual({ name: "Kevin", initialElo: 1500, discordId: "340500831973670913" });
  });

  it("omits discordId when the column is null or absent (pre-migration database)", () => {
    expect(rowToPlayer({ name: "Kevin", initial_elo: 1500, discord_id: null }))
      .toEqual({ name: "Kevin", initialElo: 1500 });
    expect(rowToPlayer({ name: "Kevin", initial_elo: 1500 }))
      .toEqual({ name: "Kevin", initialElo: 1500 });
  });
});

describe("playerToRow", () => {
  it("writes discord_id so a delete-and-reinsert save keeps the mapping", () => {
    expect(playerToRow({ name: "Kevin", initialElo: 1500, discordId: "340500831973670913" }))
      .toEqual({ name: "Kevin", initial_elo: 1500, discord_id: "340500831973670913" });
  });

  it("writes null when there is no discordId", () => {
    expect(playerToRow({ name: "Kevin", initialElo: 1500 }))
      .toEqual({ name: "Kevin", initial_elo: 1500, discord_id: null });
  });

  it("round-trips", () => {
    const p = { name: "Rolf", initialElo: 1500, discordId: "364542389353709570" };
    expect(rowToPlayer(playerToRow(p))).toEqual(p);
  });
});
```

- [ ] **Step 2: Run the test and check it fails**

Run: `docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v /home/rolf/cod-teams:/app -w /app node:22 npx vitest run src/playerRows.test.ts`
Expected: FAIL `Failed to resolve import "./playerRows"`

- [ ] **Step 3: Write the implementation**

`src/playerRows.ts`:

```ts
// Mapping between Supabase `players` rows and the app's Player shape.
// Kept separate from storage.ts so it can be tested without a Supabase client.

export interface PlayerRow {
  name: string;
  initial_elo: number;
  discord_id?: string | null;
}

export interface Player {
  name: string;
  initialElo: number;
  // Discord user ID, used to pre-select players who are in voice
  discordId?: string;
}

export const rowToPlayer = (row: PlayerRow): Player => ({
  name: row.name,
  initialElo: row.initial_elo,
  ...(row.discord_id ? { discordId: row.discord_id } : {}),
});

export const playerToRow = (player: Player) => ({
  name: player.name,
  initial_elo: player.initialElo,
  discord_id: player.discordId ?? null,
});
```

In `src/storage.ts`:
- Delete the `interface SupabasePlayerRow { ... }` block (lines 41–44).
- Delete the `export interface Player { ... }` block (lines 391–394). In its place, put this import at the top of the file with the other imports:

  ```ts
  import { playerToRow, rowToPlayer, type Player, type PlayerRow } from './playerRows';
  export type { Player } from './playerRows';
  ```
- In `getPlayers`, replace

  ```ts
      return (data || []).map((row: SupabasePlayerRow) => ({
        name: row.name,
        initialElo: row.initial_elo,
      }));
  ```
  with
  ```ts
      return (data || []).map((row: PlayerRow) => rowToPlayer(row));
  ```
- In `savePlayers`, replace

  ```ts
      const playersData = players.map(player => ({
        name: player.name,
        initial_elo: player.initialElo,
      }));
  ```
  with
  ```ts
      // Carries discord_id: this save deletes every row first, so omitting it would wipe the mapping
      const playersData = players.map(playerToRow);
  ```
- Run `grep -n SupabasePlayerRow src/storage.ts` and expect no output. Leave `DEFAULT_PLAYERS` in `App.tsx` without IDs: the fallback list stays ID-free, as the spec says.

- [ ] **Step 4: Run tests, type-check and lint**

Run: `docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v /home/rolf/cod-teams:/app -w /app node:22 sh -c 'npm test && npx tsc -b && npm run lint'`
Expected: all tests pass (5 new ones), no type errors, and lint reports no errors.

- [ ] **Step 5: Commit**

```bash
git add src/playerRows.ts src/playerRows.test.ts src/storage.ts
git commit -m "Carry players.discord_id through storage without risking it on save"
```

---

### Task 5: `/api/voice-members` proxy on the cod-teams server

**Files:**
- Create: `server/voiceMembers.js`
- Test: `server/voiceMembers.test.js`
- Modify: `server/index.js` (env destructure ~line 24; new route before `app.listen`)
- Create: `server/.env.example`

**Interfaces:**
- Consumes: the bot's `GET /voice-members` response `{"members": [{"id": string, ...}]}` (Task 1).
- Produces:
  - `fetchVoiceDiscordIds({ url, token, fetchImpl?, timeoutMs? }) -> Promise<string[]>`, deduplicated.
  - `voiceMembersHandler({ url, token, fetchImpl? }) -> (req, res) => Promise<void>`
  - HTTP `GET /api/voice-members` returns 200 `{"discordIds": string[]}`, 502 `{"error"}`, or 503 `{"error"}`. Task 6 consumes it.

- [ ] **Step 1: Write the failing test**

`server/voiceMembers.test.js`:

```js
import { describe, it, expect, vi } from "vitest";
import { fetchVoiceDiscordIds, voiceMembersHandler } from "./voiceMembers.js";

const okFetch = (body) => vi.fn(async () => ({ ok: true, status: 200, json: async () => body }));
const fakeRes = () => {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (body) => ((res.body = body), res);
  return res;
};

describe("fetchVoiceDiscordIds", () => {
  it("sends the bearer token and returns only IDs", async () => {
    const fetchImpl = okFetch({ members: [{ id: "1", display_name: "Glow", channel: "Gaming" }] });
    const ids = await fetchVoiceDiscordIds({ url: "http://bot/voice-members", token: "t", fetchImpl });
    expect(ids).toEqual(["1"]);
    expect(fetchImpl.mock.calls[0][0]).toBe("http://bot/voice-members");
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe("Bearer t");
  });

  it("deduplicates someone reported twice", async () => {
    const fetchImpl = okFetch({ members: [{ id: "1" }, { id: "1" }, { id: "2" }] });
    expect(await fetchVoiceDiscordIds({ url: "u", token: "t", fetchImpl })).toEqual(["1", "2"]);
  });

  it("throws on a non-2xx bot response", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    await expect(fetchVoiceDiscordIds({ url: "u", token: "t", fetchImpl })).rejects.toThrow("503");
  });

  it("throws when the body has no members list", async () => {
    await expect(fetchVoiceDiscordIds({ url: "u", token: "t", fetchImpl: okFetch({}) })).rejects.toThrow();
  });

  it("aborts after the timeout", async () => {
    const fetchImpl = vi.fn((_url, { signal }) => new Promise((_, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason));
    }));
    await expect(fetchVoiceDiscordIds({ url: "u", token: "t", fetchImpl, timeoutMs: 20 })).rejects.toThrow();
  });
});

describe("voiceMembersHandler", () => {
  it("returns discordIds on success", async () => {
    const res = fakeRes();
    await voiceMembersHandler({ url: "u", token: "t", fetchImpl: okFetch({ members: [{ id: "1" }] }) })({}, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ discordIds: ["1"] });
  });

  it("returns 502 when the bot fails", async () => {
    const res = fakeRes();
    const fetchImpl = vi.fn(async () => { throw new Error("ECONNREFUSED"); });
    await voiceMembersHandler({ url: "u", token: "t", fetchImpl })({}, res);
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: "Discord niet bereikbaar" });
  });

  it("returns 503 without calling the bot when no token is configured", async () => {
    const res = fakeRes();
    const fetchImpl = vi.fn();
    await voiceMembersHandler({ url: "u", token: "", fetchImpl })({}, res);
    expect(res.statusCode).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test and check it fails**

Run: `docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v /home/rolf/cod-teams:/app -w /app node:22 npx vitest run server/voiceMembers.test.js`
Expected: FAIL `Failed to load url ./voiceMembers.js`

- [ ] **Step 3: Write the implementation**

`server/voiceMembers.js`:

```js
// Proxies the Discord bot's voice-member list (server-configs/discord-bot/voice_api.py),
// reduced to Discord user IDs so display and channel names never reach the browser.

export async function fetchVoiceDiscordIds({ url, token, fetchImpl = fetch, timeoutMs = 5000 }) {
  const res = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`voice API returned ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body?.members)) throw new Error("voice API returned no members list");
  return [...new Set(body.members.map((m) => String(m.id)))];
}

export function voiceMembersHandler({ url, token, fetchImpl }) {
  return async (req, res) => {
    if (!token) {
      return res.status(503).json({ error: "Discord koppeling niet geconfigureerd" });
    }
    try {
      const discordIds = await fetchVoiceDiscordIds({ url, token, fetchImpl });
      return res.json({ discordIds });
    } catch (err) {
      console.error("Voice members error:", err.message);
      return res.status(502).json({ error: "Discord niet bereikbaar" });
    }
  };
}
```

In `server/index.js`:
- Add `import { voiceMembersHandler } from "./voiceMembers.js";` after the `./prompt.js` import.
- Add to the `process.env` destructure, after `SUPABASE_ANON_KEY,`:

  ```js
    VOICE_API_URL = "https://knoeks.rolf.bible/api/voice-members",
    VOICE_API_TOKEN = "",
  ```
- Directly before `app.listen(`, add:

  ```js
  // Who is in Discord voice, for pre-selecting players. Public like the leaderboard;
  // optional, so a missing VOICE_API_TOKEN yields 503 instead of refusing to boot.
  app.get(
    "/api/voice-members",
    (req, res, next) => {
      const ip = req.headers["x-real-ip"] || req.ip;
      if (!checkRateLimit(ip)) {
        return res.status(429).json({ error: "Te veel verzoeken. Probeer het over een minuut opnieuw." });
      }
      next();
    },
    voiceMembersHandler({ url: VOICE_API_URL, token: VOICE_API_TOKEN })
  );
  ```

Create `server/.env.example`:

```bash
# Copy to server/.env (gitignored). Read by server/index.js at startup.
ANTHROPIC_API_KEY=sk-ant-...
# Optional: override the screenshot model
# ANTHROPIC_MODEL=claude-sonnet-5
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
PORT=3001
# Discord voice pre-selection (server-configs/discord-bot). Without a token the
# /api/voice-members route answers 503 and the page keeps its default selection.
VOICE_API_URL=https://knoeks.rolf.bible/api/voice-members
VOICE_API_TOKEN=same-value-as-the-bot's-VOICE_API_TOKEN
```

- [ ] **Step 4: Run the tests and check they pass, then check the server module parses**

Run: `docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v /home/rolf/cod-teams:/app -w /app node:22 sh -c 'npx vitest run server/voiceMembers.test.js && node --check server/index.js && echo parsed'`
Expected: 8 passed, then `parsed`.

- [ ] **Step 5: Commit**

```bash
git add server/voiceMembers.js server/voiceMembers.test.js server/index.js server/.env.example
git commit -m "Add /api/voice-members proxy to the Discord bot"
```

---

### Task 6: Frontend pre-selection and "Sync met Discord" (cod-teams)

**Files:**
- Create: `src/discordVoice.ts`
- Test: `src/discordVoice.test.ts`
- Modify: `src/App.tsx`: imports (lines 10, 16), state (~line 150), `loadPlayers` effect (~line 169), `onActivePlayersChange` (~line 269), and the "Selecteer spelers" heading (~line 378)

**Interfaces:**
- Consumes: `GET /api/voice-members` returning `{discordIds: string[]}` (Task 5), and `getPlayers(): Promise<Player[]>` with `discordId?` (Task 4).
- Produces (in `src/discordVoice.ts`):
  - `interface VoicePlayer { name: string; discordId?: string }`
  - `MIN_PLAYERS = 4`
  - `playersInVoice(players: VoicePlayer[], discordIds: string[]): string[]`
  - `voiceSyncOutcome(inVoice: string[]): { apply: boolean; status: string }`
  - `shouldApplyLoadResult(selectionTouched: boolean): boolean`
  - `fetchVoiceDiscordIds(fetchImpl?: typeof fetch): Promise<string[]>`

- [ ] **Step 1: Write the failing test**

`src/discordVoice.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import {
  fetchVoiceDiscordIds,
  playersInVoice,
  shouldApplyLoadResult,
  voiceSyncOutcome,
} from "./discordVoice";

const players = [
  { name: "Frank", discordId: "381801709539688448" },
  { name: "Kevin", discordId: "340500831973670913" },
  { name: "Rolf", discordId: "364542389353709570" },
  { name: "Scott" }, // no mapping
];

describe("playersInVoice", () => {
  it("returns mapped players in player-list order", () => {
    expect(playersInVoice(players, ["364542389353709570", "381801709539688448"])).toEqual(["Frank", "Rolf"]);
  });

  it("ignores voice members without a player (guests)", () => {
    expect(playersInVoice(players, ["999", "340500831973670913"])).toEqual(["Kevin"]);
  });

  it("never matches a player without a discordId", () => {
    expect(playersInVoice(players, [""])).toEqual([]);
  });

  it("returns nothing for an empty voice list", () => {
    expect(playersInVoice(players, [])).toEqual([]);
  });
});

describe("voiceSyncOutcome", () => {
  it("applies and counts when at least 4 are in voice", () => {
    expect(voiceSyncOutcome(["A", "B", "C", "D"])).toEqual({ apply: true, status: "4 spelers in voice" });
  });

  it("does not apply 1-3 players, since the picker cannot go below 4", () => {
    expect(voiceSyncOutcome(["A", "B"])).toEqual({
      apply: false,
      status: "Maar 2 in voice — selectie niet aangepast",
    });
    expect(voiceSyncOutcome(["A"])).toEqual({
      apply: false,
      status: "Maar 1 in voice — selectie niet aangepast",
    });
  });

  it("reports nobody in voice", () => {
    expect(voiceSyncOutcome([])).toEqual({ apply: false, status: "Niemand in voice" });
  });
});

describe("shouldApplyLoadResult", () => {
  it("applies when the user has not touched the selection", () => {
    expect(shouldApplyLoadResult(false)).toBe(true);
  });

  it("drops a late load-time result once the user changed the selection", () => {
    expect(shouldApplyLoadResult(true)).toBe(false);
  });
});

describe("fetchVoiceDiscordIds", () => {
  it("returns the IDs from /api/voice-members", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ discordIds: ["1", "2"] })));
    expect(await fetchVoiceDiscordIds(fetchImpl)).toEqual(["1", "2"]);
    expect(fetchImpl).toHaveBeenCalledWith("/api/voice-members");
  });

  it("throws on a non-2xx response (bot down, or no /api on the GitHub Pages copy)", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 502 }));
    await expect(fetchVoiceDiscordIds(fetchImpl)).rejects.toThrow("502");
  });

  it("throws on a malformed body", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ nope: 1 })));
    await expect(fetchVoiceDiscordIds(fetchImpl)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test and check it fails**

Run: `docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v /home/rolf/cod-teams:/app -w /app node:22 npx vitest run src/discordVoice.test.ts`
Expected: FAIL `Failed to resolve import "./discordVoice"`

- [ ] **Step 3: Write the implementation**

`src/discordVoice.ts`:

```ts
// Pre-selects players who are in a Discord voice channel (see server/voiceMembers.js).

export interface VoicePlayer {
  name: string;
  discordId?: string;
}

// Same floor onActivePlayersChange enforces: a smaller selection would lock the picker
export const MIN_PLAYERS = 4;

export const playersInVoice = (players: VoicePlayer[], discordIds: string[]): string[] => {
  const inVoice = new Set(discordIds);
  return players.filter((p) => p.discordId && inVoice.has(p.discordId)).map((p) => p.name);
};

export const voiceSyncOutcome = (inVoice: string[]): { apply: boolean; status: string } => {
  const n = inVoice.length;
  if (n === 0) return { apply: false, status: "Niemand in voice" };
  if (n < MIN_PLAYERS) return { apply: false, status: `Maar ${n} in voice — selectie niet aangepast` };
  return { apply: true, status: `${n} spelers in voice` };
};

// The load-time sync must not overwrite a selection the user already changed
export const shouldApplyLoadResult = (selectionTouched: boolean): boolean => !selectionTouched;

export const fetchVoiceDiscordIds = async (fetchImpl: typeof fetch = fetch): Promise<string[]> => {
  const res = await fetchImpl("/api/voice-members");
  if (!res.ok) throw new Error(`voice-members returned ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body?.discordIds)) throw new Error("voice-members returned no discordIds");
  return body.discordIds.map(String);
};
```

- [ ] **Step 4: Run the tests and check they pass**

Run: `docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v /home/rolf/cod-teams:/app -w /app node:22 npx vitest run src/discordVoice.test.ts`
Expected: 12 passed

- [ ] **Step 5: Wire into `App.tsx`**

Imports: change line 10 to `import { useEffect, useState, useMemo, useRef } from "react";`, and after the `./storage` import add:

```ts
import {
  fetchVoiceDiscordIds,
  playersInVoice,
  shouldApplyLoadResult,
  voiceSyncOutcome,
  type VoicePlayer,
} from "./discordVoice";
```

State: after `const [isCalculatingTeams, setIsCalculatingTeams] = useState(false);`, add:

```ts
  const [voicePlayers, setVoicePlayers] = useState<VoicePlayer[]>([]);
  const [voiceSyncStatus, setVoiceSyncStatus] = useState<string | null>(null);
  const [isSyncingVoice, setIsSyncingVoice] = useState(false);
  // Set once the user changes the selection, so a slow load-time sync cannot overwrite it
  const selectionTouched = useRef(false);

  // fromButton: show the outcome and always apply; on load: silent, and only if untouched
  const syncWithDiscord = async (players: VoicePlayer[], fromButton: boolean) => {
    if (fromButton) setIsSyncingVoice(true);
    try {
      const inVoice = playersInVoice(players, await fetchVoiceDiscordIds());
      const outcome = voiceSyncOutcome(inVoice);
      if (outcome.apply && (fromButton || shouldApplyLoadResult(selectionTouched.current))) {
        setActivePlayers(inVoice);
      }
      if (fromButton) setVoiceSyncStatus(outcome.status);
    } catch (error) {
      console.warn("Discord voice sync failed:", error);
      if (fromButton) setVoiceSyncStatus("Discord niet bereikbaar");
    } finally {
      if (fromButton) setIsSyncingVoice(false);
    }
  };
```

`loadPlayers` effect: inside `if (players.length > 0) { ... }`, after the existing `setActivePlayers(...)` call, add:

```ts
        setVoicePlayers(players);
        void syncWithDiscord(players, false);
```

`onActivePlayersChange`: mark the selection as touched only when the change is accepted:

```ts
  const onActivePlayersChange = (newActivePlayers: string[]) => {
    if (newActivePlayers.length < 4) return;
    selectionTouched.current = true;
    setActivePlayers(newActivePlayers);
  };
```

Heading: replace

```tsx
          <Heading className="text-xl md:text-2xl text-center font-display font-bold text-cyber-cyan">
            👥 Selecteer spelers
          </Heading>
```

with

```tsx
          <Heading className="text-xl md:text-2xl text-center font-display font-bold text-cyber-cyan">
            👥 Selecteer spelers
          </Heading>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              size="sm"
              variant="outline"
              loading={isSyncingVoice}
              disabled={voicePlayers.length === 0}
              onClick={() => void syncWithDiscord(voicePlayers, true)}
            >
              🎧 Sync met Discord
            </Button>
            {voiceSyncStatus && <span className="text-sm text-gray-300">{voiceSyncStatus}</span>}
          </div>
```

The button is disabled when players came from the ID-free fallback list (`voicePlayers` stays empty).

- [ ] **Step 6: Full verification**

Run: `docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v /home/rolf/cod-teams:/app -w /app node:22 sh -c 'npm test && npm run lint && npm run build'`
Expected: all tests pass, lint has no errors, and the build succeeds. The build output goes to `dist/`, which is gitignored, and is **not** deployed from here.

- [ ] **Step 7: Document in `claude.md`**

In `claude.md`, under "Critical File Map → Core Application Logic", add:

```markdown
- **`src/discordVoice.ts`** - Discord voice pre-selection: maps `/api/voice-members` Discord IDs to players (`players.discord_id`), applies only when ≥ 4 are in voice. Unit tested in `src/discordVoice.test.ts`.
- **`server/voiceMembers.js`** - `/api/voice-members`: proxies the Discord bot in server-configs (`https://knoeks.rolf.bible/api/voice-members`, Bearer `VOICE_API_TOKEN` from `server/.env`), returns IDs only.
- **`scripts/backup-supabase.mjs`** - Read-only snapshot of all tables; `--compare <file>` after any migration must report "No data lost or changed."
```

- [ ] **Step 8: Commit, push, draft PR**

```bash
git add src/discordVoice.ts src/discordVoice.test.ts src/App.tsx claude.md
git commit -m "Pre-select players in Discord voice; add Sync met Discord button"
git push
gh pr create --draft --title "Pre-select players who are in Discord voice" --body "..."
```

The PR body: link the spec and plan, list the rollout steps from Task 7, and say that merging deploys production.

---

### Task 7: Rollout (steps marked 👤 are Rolf's)

Order matters. Each step is safe on its own.

- [ ] **Step 1: Deploy the bot and Caddy on game-server** (needs Rolf's go-ahead, because it restarts the live bot)

```bash
cd <server-configs worktree>
./deploy.sh discord-bot
# Create the live .env from the current compose values plus a new token:
#   /opt/stacks/discord-bot/.env  <- DISCORD_TOKEN, CHANNEL_ID, DOMAIN from the old
#   /opt/stacks/discord-bot/docker-compose.yml (before deploy overwrote it: read it
#   from `git show main:discord-bot/docker-compose.yml`), plus
#   VOICE_API_TOKEN=$(openssl rand -hex 32)
chmod 600 /opt/stacks/discord-bot/.env
cd /opt/stacks/discord-bot && docker compose up -d --build
docker logs discord-bot --tail 20   # expect "Voice-members endpoint listening on :8080"
```

Add the same `handle /api/voice-members { ... }` block from Task 2 Step 5 to the live `/opt/stacks/nginx/Caddyfile`, then run `docker exec caddy caddy reload --config /etc/caddy/Caddyfile`.

Verify:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: knoeks.rolf.bible' http://localhost/api/voice-members   # 401
curl -s -H 'Host: knoeks.rolf.bible' -H "Authorization: Bearer $TOKEN" http://localhost/api/voice-members  # {"members": [...]}
curl -s -o /dev/null -w '%{http_code}\n' https://knoeks.rolf.bible/api/voice-members                       # 401 via the public proxy
```

- [ ] **Step 2: Snapshot Supabase** (read-only, from game-server)

Create `/home/rolf/cod-teams/.env` (gitignored) with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, copied from the qmg box's `.env`. They're also in the public bundle at qmg.rolf.bible. Then:

```bash
docker run --rm -u "$(id -u):$(id -g)" -v /home/rolf/cod-teams:/app -w /app node:22 node scripts/backup-supabase.mjs
docker run --rm -u "$(id -u):$(id -g)" -v /home/rolf/cod-teams:/app -w /app node:22 node scripts/verify-ratings.mjs
```

Expected: `Snapshot written: …/supabase-backups/<ts>.json` with row counts, and the verify run shows zero drift. Record both outputs. The snapshot file is the backup; keep it.

- [ ] **Step 3: 👤 Run `supabase-add-discord-ids.sql` in the Supabase SQL editor**

Expected: the final `SELECT` lists 12 players, each with a `discord_id`. If any statement errors, the transaction rolls back and nothing changes. Report the error.

- [ ] **Step 4: Prove nothing was lost**

```bash
docker run --rm -u "$(id -u):$(id -g)" -v /home/rolf/cod-teams:/app -w /app node:22 node scripts/backup-supabase.mjs --compare supabase-backups/<ts>.json
docker run --rm -u "$(id -u):$(id -g)" -v /home/rolf/cod-teams:/app -w /app node:22 node scripts/verify-ratings.mjs
```

Expected: 12 `ok       players X: discord_id set to …` lines, then `No data lost or changed.` (exit 0), and verify still shows zero drift. Any `PROBLEM` line stops the rollout until it's understood. A `row added` in `match_history` just means a match was recorded in between; confirm with Rolf.

- [ ] **Step 5: 👤 On the qmg box, add the voice keys to `server/.env`**

```bash
# /home/rolf/git/cod-teams/server/.env
VOICE_API_URL=https://knoeks.rolf.bible/api/voice-members
VOICE_API_TOKEN=<the VOICE_API_TOKEN from game-server's /opt/stacks/discord-bot/.env>
```

- [ ] **Step 6: 👤 Merge the cod-teams PR, then restart the server**

The qmg box's `deploy.sh` picks up the new `main`, builds with base `/` and rsyncs. If `systemctl status cod-teams-server` shows it wasn't restarted, run `sudo systemctl restart cod-teams-server`. Also merge the server-configs PR.

- [ ] **Step 7: End-to-end check**

```bash
curl -s https://qmg.rolf.bible/api/voice-members   # {"discordIds":[...]} - IDs of whoever is in voice right now
```

With 4 or more mapped players in voice, hard-refresh qmg.rolf.bible in a browser. The selection should show exactly those players, and "🎧 Sync met Discord" should show `N spelers in voice`. With fewer than 4, the default selection stays and the button shows the `Maar N in voice` text.

- [ ] **Step 8: 👤 Reset the old bot token**

Discord Developer Portal → Bot → Reset Token. Put the new token in `/opt/stacks/discord-bot/.env`, run `docker compose up -d`, and check that the logs show the bot connected. Also confirm Server Members Intent is off.
