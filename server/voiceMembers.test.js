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
