import type { ScreenshotAnalysisResult } from "../types";
import { supabase } from "../supabaseClient";
import { isGameMode } from "../gameMode";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Strip the data:image/...;base64, prefix
      resolve(dataUrl.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function analyzeScreenshot(
  file: File
): Promise<ScreenshotAnalysisResult> {
  const base64 = await fileToBase64(file);

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Je moet ingelogd zijn om screenshots te analyseren");
  }

  const response = await fetch("/api/analyze-screenshot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      image: base64,
      mediaType: file.type || "image/png",
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      err.error || `Analyse mislukt (${response.status})`
    );
  }

  const result: ScreenshotAnalysisResult = await response.json();

  // The model is asked for a specific mode string; anything else means it
  // couldn't tell, and the user keeps whatever is selected in the dialog
  return {
    ...result,
    gameMode: isGameMode(result.gameMode) ? result.gameMode : null,
  };
}
