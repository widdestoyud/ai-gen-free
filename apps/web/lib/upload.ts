import { resolveUploadUrl } from "./format";

export type UploadItemProgress = {
  id: string;
  file: File;
  name: string;
  alias?: string | null;
  url: string;
  progress: number;
  uploading: boolean;
  error?: string | null;
  width?: number;
  height?: number;
};

export type UploadSuccessResult = {
  id: string;
  url: string;
  width?: number;
  height?: number;
  alias?: string;
};

export type UploadOptions = {
  onProgress?: (progress: number) => void;
  onSuccess?: (result: UploadSuccessResult) => void;
  onError?: (errorMessage: string) => void;
};

export type UploadController = {
  abort: () => void;
  promise: Promise<UploadSuccessResult>;
};

/**
 * Single source of truth untuk upload berkas pelanggan dengan progress bar realtime via XMLHttpRequest.
 */
export function uploadFileWithProgress(
  file: File,
  options: UploadOptions = {},
): UploadController {
  const cleanName = file.name.replace(/\.[^/.]+$/, "");
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("alias", cleanName);

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/customer-uploads");

  const promise = new Promise<UploadSuccessResult>((resolve, reject) => {
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.min(99, Math.max(1, Math.round((event.loaded / event.total) * 100)));
        options.onProgress?.(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as {
            id: string;
            url: string;
            width?: number;
            height?: number;
            alias?: string;
          };
          const finalUrl = resolveUploadUrl(data.url, data.id);
          const finalAlias = (data.alias || cleanName).replace(/\.[^/.]+$/, "");
          const result: UploadSuccessResult = {
            id: data.id,
            url: finalUrl,
            width: data.width,
            height: data.height,
            alias: finalAlias,
          };
          options.onProgress?.(100);
          options.onSuccess?.(result);
          resolve(result);
        } catch {
          const msg = "Gagal memproses respon berkas unggahan";
          options.onError?.(msg);
          reject(new Error(msg));
        }
      } else {
        let msg = "Gagal mengunggah berkas";
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (parsed?.error?.message) msg = parsed.error.message;
        } catch {}
        options.onError?.(msg);
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => {
      const msg = "Gagal terhubung ke server saat mengunggah berkas";
      options.onError?.(msg);
      reject(new Error(msg));
    };

    xhr.onabort = () => {
      reject(new Error("Upload dibatalkan"));
    };

    xhr.send(formData);
  });

  return {
    abort: () => xhr.abort(),
    promise,
  };
}
