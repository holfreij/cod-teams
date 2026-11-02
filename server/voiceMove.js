// Asks the Discord bot (server-configs/discord-bot/voice_api.py) to move a proposed team
// split into the two team voice channels. Only Discord IDs cross this boundary.

const MAX_IDS = 32;

export async function moveTeams({ url, token, teams, fetchImpl = fetch, timeoutMs = 10000 }) {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ teams }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`voice API returned ${res.status}`);
  const body = await res.json();
  if (![body?.moved, body?.not_in_voice, body?.failed].every(Array.isArray)) {
    throw new Error("voice API returned an unexpected move result");
  }
  return { moved: body.moved, notInVoice: body.not_in_voice, failed: body.failed };
}

function validTeams(teams) {
  if (!Array.isArray(teams) || teams.length !== 2 || !teams.every(Array.isArray)) return false;
  const ids = teams.flat();
  return (
    ids.length <= MAX_IDS &&
    new Set(ids).size === ids.length &&
    ids.every((id) => typeof id === "string" && /^[0-9]+$/.test(id))
  );
}

export function voiceMoveHandler({ url, token, fetchImpl, verifyUser }) {
  return async (req, res) => {
    if (!(await verifyUser(req))) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    if (!token) {
      return res.status(503).json({ error: "Discord koppeling niet geconfigureerd" });
    }
    const teams = req.body?.teams;
    if (!validTeams(teams)) {
      return res.status(400).json({ error: "teams moet twee lijsten met Discord-ID's zijn" });
    }
    try {
      return res.json(await moveTeams({ url, token, teams, fetchImpl }));
    } catch (err) {
      console.error("Voice move error:", err.message);
      return res.status(502).json({ error: "Discord niet bereikbaar" });
    }
  };
}
