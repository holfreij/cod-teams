import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@chakra-ui/react";
import { analyzeScreenshot } from "../services/screenshotAnalyzer";
import type { ScreenshotAnalysisResult } from "../types";
import { GAME_MODES } from "../gameMode";
import { StatsTable } from "./StatsTable";

interface ScreenshotUploadProps {
  // null = screenshot removed, previously reported stats no longer apply
  onResult: (result: ScreenshotAnalysisResult | null) => void;
  dialogOpen: boolean;
}

export const ScreenshotUpload = ({ onResult, dialogOpen }: ScreenshotUploadProps) => {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lowConfidence, setLowConfidence] = useState(false);
  const [result, setResult] = useState<ScreenshotAnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Selecteer een afbeelding");
      return;
    }

    setError(null);
    setLowConfidence(false);
    setResult(null);
    setPreview(URL.createObjectURL(file));
    setLoading(true);

    try {
      const res = await analyzeScreenshot(file);
      if (res.confidence < 0.6) {
        setLowConfidence(true);
      }
      setResult(res);
      onResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analyse mislukt");
    } finally {
      setLoading(false);
    }
  }, [onResult]);

  // Clipboard paste listener
  useEffect(() => {
    if (!dialogOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) processFile(file);
          return;
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [dialogOpen, processFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const reset = () => {
    setPreview(null);
    setError(null);
    setLowConfidence(false);
    setLoading(false);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onResult(null);
  };

  return (
    <div className="flex flex-col gap-2 p-3 border border-dashed border-cyber-cyan/30 rounded-lg bg-cyber-dark-secondary/30">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {!preview && !loading && (
        <div className="flex flex-col items-center gap-2">
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="cyber-btn-primary px-4 py-3 rounded-lg w-full text-base min-h-[48px]"
            disabled={loading}
          >
            Upload screenshot
          </Button>
          <span className="text-xs text-gray-500">
            of plak een screenshot (Ctrl+V)
          </span>
        </div>
      )}

      {preview && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <img
              src={preview}
              alt="Screenshot preview"
              className="h-20 w-auto rounded border border-cyber-cyan/20 object-cover"
            />
            <button
              onClick={reset}
              className="text-gray-500 hover:text-gray-300 text-lg px-1"
              title="Verwijder screenshot"
            >
              ✕
            </button>
          </div>
          <div>
            {loading && (
              <div className="flex items-center gap-2 text-cyber-cyan text-sm">
                <div className="cyber-spinner-sm" />
                <span>Analyseren...</span>
              </div>
            )}
            {lowConfidence && !loading && (
              <span className="text-yellow-400 text-xs">
                Lage betrouwbaarheid — controleer de scores
              </span>
            )}
            {error && (
              <span className="text-red-400 text-xs">{error}</span>
            )}
            {!loading && !error && !lowConfidence && result && (
              <span className="text-green-400 text-xs">
                Scores ingevuld
                {result.gameMode && ` — ${GAME_MODES[result.gameMode].label} herkend`}
              </span>
            )}
          </div>

          {result && (result.team1Players.length > 0 || result.team2Players.length > 0) && (
            <>
              {result.team1Score != null && result.team2Score != null ? (
                <p className="text-sm font-display font-semibold text-center mt-1">
                  <span className="text-cyber-cyan">Team 1: {result.team1Score}</span>
                  <span className="text-gray-500 mx-2">—</span>
                  <span className="text-cyber-pink">Team 2: {result.team2Score}</span>
                </p>
              ) : (
                <p className="text-yellow-400 text-xs text-center mt-1">
                  Eindstand niet herkend — vul de scores handmatig in
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                {result.team1Players.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-cyber-cyan mb-1">Team 1</p>
                    <StatsTable players={result.team1Players} teamColor="cyber-cyan" />
                  </div>
                )}
                {result.team2Players.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-cyber-pink mb-1">Team 2</p>
                    <StatsTable players={result.team2Players} teamColor="cyber-pink" />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
