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

// --- Moving a proposed split into the Discord team channels (see server/voiceMove.js) ---

export interface MoveResult {
  moved: string[];
  notInVoice: string[];
  failed: string[];
}

// Names without a linked Discord account cannot be moved; they are reported, not dropped silently
export const teamDiscordIds = (
  team: { name: string }[],
  players: VoicePlayer[]
): { ids: string[]; unlinked: string[] } => {
  const idByName = new Map(players.map((p) => [p.name, p.discordId]));
  const ids: string[] = [];
  const unlinked: string[] = [];
  for (const { name } of team) {
    const id = idByName.get(name);
    if (id) ids.push(id);
    else unlinked.push(name);
  }
  return { ids, unlinked };
};

export const moveTeamsToVoice = async (
  teams: [string[], string[]],
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<MoveResult> => {
  const res = await fetchImpl("/api/move-to-voice", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ teams }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `move-to-voice returned ${res.status}`);
  }
  return res.json();
};

export const moveOutcomeStatus = (
  result: MoveResult,
  idToName: Record<string, string>,
  unlinked: string[]
): string => {
  const names = (ids: string[]) => ids.map((id) => idToName[id] ?? id).join(", ");
  return [
    `${result.moved.length} verplaatst`,
    result.notInVoice.length > 0 && `niet in voice: ${names(result.notInVoice)}`,
    unlinked.length > 0 && `geen Discord: ${unlinked.join(", ")}`,
    result.failed.length > 0 && `mislukt: ${names(result.failed)}`,
  ]
    .filter(Boolean)
    .join(" · ");
};
