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
