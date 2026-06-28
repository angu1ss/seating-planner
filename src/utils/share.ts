import type { ProjectState } from "../types";

/** Fragment prefixes: `#p=` gzipped+base64url, `#r=` raw base64url(JSON) fallback. */
export const SHARE_PREFIX = "#p=";
const RAW_PREFIX = "#r=";

/** True if a location hash carries a shared project (either encoding). */
export function isShareHash(hash: string): boolean {
  return hash.startsWith(SHARE_PREFIX) || hash.startsWith(RAW_PREFIX);
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Pipe through the (de)compression stream and read concurrently — writing everything
// first and only then reading can deadlock once the internal buffer fills.
async function gzip(text: string): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

/**
 * Build a self-contained share URL whose fragment holds the gzipped project snapshot.
 * No backend — the recipient's app decodes the fragment locally. Long for big projects;
 * the fragment isn't sent to the server (GitHub Pages), so there's no server URL limit.
 */
export async function buildShareLink(doc: ProjectState): Promise<string> {
  const json = JSON.stringify(doc);
  const base = `${location.origin}${location.pathname}`;
  try {
    return `${base}${SHARE_PREFIX}${toBase64Url(await gzip(json))}`;
  } catch {
    // CompressionStream unavailable/blocked → fall back to a (longer) uncompressed link.
    return `${base}${RAW_PREFIX}${toBase64Url(new TextEncoder().encode(json))}`;
  }
}

/** Small, fast 53-bit string hash (cyrb53) → base36 string. */
function cyrb53(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Content fingerprint — excludes volatile fields (updatedAt, active hall) so two copies
 * of the same project content compare equal. */
export function hashDocument(doc: ProjectState): string {
  return cyrb53(
    JSON.stringify({
      project: doc.project,
      settings: doc.settings,
      sheets: doc.sheets,
      guests: doc.guests,
    }),
  );
}

/** A blank / default project (no name, no guests, no tables or objects). */
export function isEmptyDocument(doc: ProjectState): boolean {
  return (
    !doc.project?.name?.trim() &&
    (doc.guests?.length ?? 0) === 0 &&
    (doc.sheets ?? []).every((sh) => (sh.tables?.length ?? 0) === 0 && (sh.objects?.length ?? 0) === 0)
  );
}

/** Read a shared project from a location hash, or null if absent / malformed. */
export async function readShareLink(hash: string): Promise<ProjectState | null> {
  try {
    let json: string | null = null;
    if (hash.startsWith(SHARE_PREFIX)) {
      json = await gunzip(fromBase64Url(hash.slice(SHARE_PREFIX.length)));
    } else if (hash.startsWith(RAW_PREFIX)) {
      json = new TextDecoder().decode(fromBase64Url(hash.slice(RAW_PREFIX.length)));
    }
    if (!json) return null;
    const doc = JSON.parse(json) as ProjectState;
    if (!doc || !doc.project || !doc.sheets) return null;
    return doc;
  } catch {
    return null;
  }
}
