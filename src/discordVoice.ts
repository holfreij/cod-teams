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
