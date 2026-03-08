import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@chakra-ui/react";
import { analyzeScreenshot } from "../services/screenshotAnalyzer";
import type { ScreenshotAnalysisResult } from "../types";

interface ScreenshotUploadProps {
  onResult: (result: ScreenshotAnalysisResult) => void;
  dialogOpen: boolean;
}

export const ScreenshotUpload = ({ onResult, dialogOpen }: ScreenshotUploadProps) => {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lowConfidence, setLowConfidence] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Selecteer een afbeelding");
      return;
    }

    setError(null);
    setLowConfidence(false);
    setPreview(URL.createObjectURL(file));
    setLoading(true);

    try {
      const result = await analyzeScreenshot(file);
      if (result.confidence < 0.6) {
        setLowConfidence(true);
      }
      onResult(result);
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
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-2 p-3 border border-dashed border-cyber-cyan/30 rounded-lg bg-cyber-dark-secondary/30">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
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
            📸 Upload screenshot
          </Button>
          <span className="text-xs text-gray-500">
            of plak een screenshot (Ctrl+V)
          </span>
        </div>
      )}

      {preview && (
        <div className="flex items-center gap-3">
          <img
            src={preview}
            alt="Screenshot preview"
            className="h-16 w-auto rounded border border-cyber-cyan/20 object-cover"
          />
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            {loading && (
              <div className="flex items-center gap-2 text-cyber-cyan text-sm">
                <div className="cyber-spinner-sm" />
                <span>Analyseren...</span>
              </div>
            )}
            {lowConfidence && !loading && (
              <span className="text-yellow-400 text-xs">
                ⚠️ Lage betrouwbaarheid — controleer de scores
              </span>
            )}
            {error && (
              <span className="text-red-400 text-xs">{error}</span>
            )}
            {!loading && !error && !lowConfidence && (
              <span className="text-green-400 text-xs">✓ Scores ingevuld</span>
            )}
          </div>
          <button
            onClick={reset}
            className="text-gray-500 hover:text-gray-300 text-lg px-1"
            title="Verwijder screenshot"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
