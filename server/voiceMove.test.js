import { describe, it, expect, vi } from "vitest";
import { moveTeams, voiceMoveHandler } from "./voiceMove.js";

const botBody = { moved: ["1"], not_in_voice: ["2"], failed: [] };
const okFetch = (body = botBody) => vi.fn(async () => ({ ok: true, status: 200, json: async () => body }));
const fakeRes = () => {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (body) => ((res.body = body), res);
  return res;
};
const teams = [["1"], ["2"]];
const asUser = async () => ({ id: "u" });

describe("moveTeams", () => {
  it("posts the teams with the bearer token and camelCases the result", async () => {
    const fetchImpl = okFetch();
    const result = await moveTeams({ url: "http://bot/voice-move", token: "t", teams, fetchImpl });
    expect(result).toEqual({ moved: ["1"], notInVoice: ["2"], failed: [] });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("http://bot/voice-move");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer t");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ teams });
  });

  it("throws on a non-2xx bot response", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    await expect(moveTeams({ url: "u", token: "t", teams, fetchImpl })).rejects.toThrow("503");
  });

  it("throws when the response lacks the three arrays", async () => {
    await expect(
      moveTeams({ url: "u", token: "t", teams, fetchImpl: okFetch({ moved: [] }) })
    ).rejects.toThrow();
  });

  it("aborts after the timeout", async () => {
    const fetchImpl = vi.fn((_url, { signal }) => new Promise((_, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason));
    }));
    await expect(moveTeams({ url: "u", token: "t", teams, fetchImpl, timeoutMs: 20 })).rejects.toThrow();
  });
});

describe("voiceMoveHandler", () => {
  const run = async (opts, body = { teams }) => {
    const res = fakeRes();
    await voiceMoveHandler({ url: "u", token: "t", verifyUser: asUser, ...opts })({ body }, res);
    return res;
  };

  it("returns the move result on success", async () => {
    const res = await run({ fetchImpl: okFetch() });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ moved: ["1"], notInVoice: ["2"], failed: [] });
  });

  it("returns 401 without calling the bot when there is no valid user", async () => {
    const fetchImpl = okFetch();
    const res = await run({ fetchImpl, verifyUser: async () => null });
    expect(res.statusCode).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns 503 when no token is configured", async () => {
    const fetchImpl = okFetch();
    const res = await run({ fetchImpl, token: "" });
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: "Discord koppeling niet geconfigureerd" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["missing body", null],
    ["one team", { teams: [["1"]] }],
    ["three teams", { teams: [["1"], [], []] }],
    ["non-array team", { teams: ["1", "2"] }],
    ["non-digit id", { teams: [["x1"], []] }],
    ["numeric id", { teams: [[1], []] }],
    ["id in both teams", { teams: [["1"], ["1"]] }],
    ["too many ids", { teams: [Array.from({ length: 17 }, (_, i) => `${i}`), Array.from({ length: 16 }, (_, i) => `${i + 17}`)] }],
  ])("returns 400 for %s", async (_name, body) => {
    const fetchImpl = okFetch();
    const res = await run({ fetchImpl }, body);
    expect(res.statusCode).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns 502 when the bot fails", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("ECONNREFUSED"); });
    const res = await run({ fetchImpl });
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: "Discord niet bereikbaar" });
  });
});
