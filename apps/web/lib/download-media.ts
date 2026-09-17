/**
 * Client-side media downloader.
 * Converts WebP and other image formats into PNG entirely in the browser (0% server load)
 * using the HTML5 Canvas API before triggering the download dialog.
 */

function triggerBlobDownload(blob: Blob, filename: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
}

function triggerDirectDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function convertUrlToPngAndDownload(
  src: string,
  filename: string,
  useCrossOrigin = false
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (useCrossOrigin) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context 2D not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (pngBlob) => {
            if (!pngBlob) {
              reject(new Error("Failed to export canvas to PNG"));
              return;
            }
            triggerBlobDownload(pngBlob, filename);
            resolve();
          },
          "image/png"
        );
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Downloads an image URL as a PNG file.
 * Handles client-side WebP -> PNG conversion with fallbacks.
 */
export async function downloadImageAsPng(url: string, suggestedFilename: string): Promise<void> {
  const baseName = suggestedFilename.replace(/\.[^/.]+$/, "");
  const targetFilename = `${baseName}.png`;

  try {
    // 1. Fetch as Blob and convert to PNG via Canvas
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();

    if (blob.type === "image/png") {
      triggerBlobDownload(blob, targetFilename);
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    try {
      await convertUrlToPngAndDownload(objectUrl, targetFilename);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    // 2. Fallback: load directly into Image with anonymous CORS
    try {
      await convertUrlToPngAndDownload(url, targetFilename, true);
    } catch {
      // 3. Fallback: direct anchor download
      triggerDirectDownload(url, targetFilename);
    }
  }
}

/**
 * Universal media downloader for images (converted to PNG) and videos (native MP4).
 */
export async function downloadMediaFile({
  url,
  filename,
  isVideo = false,
}: {
  url: string;
  filename: string;
  isVideo?: boolean;
}): Promise<void> {
  if (!url) return;
  if (isVideo || url.endsWith(".mp4") || url.endsWith(".webm")) {
    const cleanName = filename.replace(/\.[^/.]+$/, "");
    triggerDirectDownload(url, `${cleanName}.mp4`);
    return;
  }
  await downloadImageAsPng(url, filename);
}
