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
