/**
 * Client-side WebCrypto DPoP (Proof-of-Possession) Manager
 * 
 * Menghasilkan dan menyimpan Private Key asimetris (ECDSA P-256) di dalam IndexedDB browser
 * dengan atribut extractable: false (tidak dapat diekspor/dicuri oleh attacker atau skrip).
 * 
 * Setiap request membuat signature kriptografi yang membuktikan kepemilikan browser asli.
 */

const DB_NAME = "satu_labs_security";
const DB_VERSION = 1;
const STORE_NAME = "dpop_keys";
const KEY_ID = "main_session_key";

interface StoredKeyPair {
  id: string;
  privateKey: CryptoKey;
  publicKeyJwk: {
    kty: "EC";
    crv: "P-256";
    x: string;
    y: string;
  };
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported in this environment"));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Mendapatkan atau membuat pasangan kunci ECDSA P-256 baru di browser.
 */
export async function getOrCreateDPoPKeyPair(): Promise<{
  privateKey: CryptoKey;
  publicKeyJwk: StoredKeyPair["publicKeyJwk"];
}> {
  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    throw new Error("WebCrypto is not supported in this environment");
  }

  const db = await openDatabase();

  return new Promise(async (resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(KEY_ID);

      getReq.onsuccess = async () => {
        const record = getReq.result as StoredKeyPair | undefined;
        if (record && record.privateKey && record.publicKeyJwk) {
          resolve({ privateKey: record.privateKey, publicKeyJwk: record.publicKeyJwk });
          return;
        }

        // Generate key pair baru jika belum ada
        try {
          const keyPair = await window.crypto.subtle.generateKey(
            {
              name: "ECDSA",
              namedCurve: "P-256",
            },
            false, // extractable: false (Private key tidak dapat diekspor keluar dari browser!)
            ["sign"],
          );

          const publicJwk = (await window.crypto.subtle.exportKey(
            "jwk",
            keyPair.publicKey,
          )) as StoredKeyPair["publicKeyJwk"];

          const saveTx = db.transaction(STORE_NAME, "readwrite");
          const saveStore = saveTx.objectStore(STORE_NAME);
          const saveRecord: StoredKeyPair = {
            id: KEY_ID,
            privateKey: keyPair.privateKey,
            publicKeyJwk: {
              kty: "EC",
              crv: "P-256",
              x: publicJwk.x,
              y: publicJwk.y,
            },
          };

          saveStore.put(saveRecord);
          saveTx.oncomplete = () => {
            resolve({ privateKey: keyPair.privateKey, publicKeyJwk: saveRecord.publicKeyJwk });
          };
          saveTx.onerror = () => reject(saveTx.error);
        } catch (err) {
          reject(err);
        }
      };

      getReq.onerror = () => reject(getReq.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Membuat DPoP proof token untuk request HTTP tertentu.
 */
export async function createDPoPProof(method: string, urlOrPath: string): Promise<string | null> {
  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    return null;
  }

  try {
    const { privateKey, publicKeyJwk } = await getOrCreateDPoPKeyPair();

    const header = {
      typ: "dpop+jwt",
      alg: "ES256",
      jwk: publicKeyJwk,
    };

    const payload = {
      jti: (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
      htm: method.toUpperCase(),
      htu: urlOrPath.split("?")[0],
      iat: Math.floor(Date.now() / 1000),
    };

    const enc = new TextEncoder();
    const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
    const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
    const dataToSign = enc.encode(`${headerB64}.${payloadB64}`);

    const signature = await window.crypto.subtle.sign(
      {
        name: "ECDSA",
        hash: { name: "SHA-256" },
      },
      privateKey,
      dataToSign,
    );

    const sigB64 = base64UrlEncode(signature);
    return `${headerB64}.${payloadB64}.${sigB64}`;
  } catch {
    return null;
  }
}
