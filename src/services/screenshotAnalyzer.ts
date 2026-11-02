import type { ScreenshotAnalysisResult } from "../types";
import { supabase } from "../supabaseClient";
import { isGameMode } from "../gameMode";

// Phone camera photos are several MB, which overflows the 10 MB request limit
// once base64-encoded and exceeds the model's 5 MB image cap. The model
// downsamples large images anyway, so shrinking here loses nothing.
const MAX_EDGE = 2048;

async function downscaleIfLarge(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Format the browser can't decode (e.g. HEIC on some platforms); send as-is
    return file;
  }
  const scale = MAX_EDGE / Math.max(bitmap.width, bitmap.height);
  if (scale >= 1) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9)
  );
  return blob ? new File([blob], "screenshot.jpg", { type: "image/jpeg" }) : file;
}

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
  original: File
): Promise<ScreenshotAnalysisResult> {
  const file = await downscaleIfLarge(original);
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
