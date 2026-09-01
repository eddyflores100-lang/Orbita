// BÓVEDA — criptografía de extremo a extremo (solo cliente)
// ---------------------------------------------------------------
// El servidor NUNCA ve la frase ni la clave. Todo el cifrado ocurre
// en el navegador con la Web Crypto API nativa:
//   * Derivación: PBKDF2-SHA256, 310.000 iteraciones (OWASP 2023+)
//   * Cifrado:    AES-GCM 256 bits con nonce aleatorio de 96 bits
//   * Integridad: SHA-256 del contenido en claro (procedencia)

const enc = new TextEncoder();
const dec = new TextDecoder();

export const KDF_ITERATIONS = 310_000;
export const VERIFIER_PLAINTEXT = "BOVEDA-VERIFIER-v1";

export function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

/** Deriva una clave AES-GCM 256 desde la frase del usuario. */
export async function deriveKey(passphrase: string, saltB64: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: fromB64(saltB64) as BufferSource, iterations: KDF_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Cifra cualquier objeto JSON → { ct, iv } en base64. */
export async function encryptJSON(key: CryptoKey, value: unknown): Promise<{ ct: string; iv: string }> {
  const iv = randomBytes(12);
  const data = enc.encode(JSON.stringify(value));
  const buf = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, data);
  return { ct: toB64(buf), iv: toB64(iv) };
}

/** Descifra { ct, iv } → objeto JSON. Lanza si la clave es incorrecta. */
export async function decryptJSON<T>(key: CryptoKey, ctB64: string, ivB64: string): Promise<T> {
  const buf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(ivB64) as BufferSource },
    key,
    fromB64(ctB64) as BufferSource,
  );
  return JSON.parse(dec.decode(buf)) as T;
}

/** Hash de integridad del contenido en claro (se guarda en el sobre). */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Crea el par sal + verificador para una bóveda nueva. */
export async function newVaultMaterial(passphrase: string): Promise<{
  salt: string;
  verifier: string;
  verifierIv: string;
  key: CryptoKey;
}> {
  const salt = toB64(randomBytes(32));
  const key = await deriveKey(passphrase, salt);
  const sealed = await encryptJSON(key, VERIFIER_PLAINTEXT);
  return { salt, verifier: sealed.ct, verifierIv: sealed.iv, key };
}

/** Comprueba una frase contra el verificador del servidor. */
export async function tryUnlock(
  passphrase: string,
  salt: string,
  verifier: string,
  verifierIv: string,
): Promise<CryptoKey | null> {
  const key = await deriveKey(passphrase, salt);
  try {
    const plain = await decryptJSON<string>(key, verifier, verifierIv);
    return plain === VERIFIER_PLAINTEXT ? key : null;
  } catch {
    return null;
  }
}

/** Puntuación simple de fortaleza de frase (0-4). */
export function passphraseStrength(p: string): number {
  let s = 0;
  if (p.length >= 10) s++;
  if (p.length >= 16) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^a-zA-Z0-9]/.test(p)) s++;
  return Math.min(s, 4);
}
