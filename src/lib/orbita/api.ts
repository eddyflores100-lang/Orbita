// ÓRBITA — Cliente de API (lado navegador).

export interface OrbitPropertyDTO {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  tone: string;
  aspect: string;
  watermarkText: string | null;
  watermarkOn: boolean;
  brandColor: string;
  features: string | null;
  hostName: string | null;
  hostPhone: string | null;
  hostEmail: string | null;
  ctaText: string;
  logline: string | null;
  musicStyle: string | null;
  bpm: number | null;
  musicVolume: number;
  voiceoverOn: boolean;
  voiceStyle: string | null;
  hotspots: string | null;
  status: string;
  published: boolean;
  views: number;
  createdAt: string;
  _count?: { photos: number; jobs: number };
}

export interface OrbitPhotoDTO {
  id: string;
  propertyId: string;
  order: number;
  file: string;
  thumb: string;
  width: number;
  height: number;
  orientation: string;
  hash: string;
  size: number;
  origin: string;
  room: string | null;
  roomConf: number | null;
  quality: number | null;
  caption: string | null;
  analysis: string | null;
}

export interface OrbitPlanDTO {
  id: string;
  propertyId: string;
  tone: string;
  format: string;
  musicStyle: string;
  bpm: number;
  logline: string | null;
  shots: string;
  source: string;
  createdAt: string;
}

export interface OrbitJobDTO {
  id: string;
  propertyId: string;
  planId: string | null;
  format: string;
  resolution: string;
  quality: string;
  status: string;
  stage: string | null;
  progress: number;
  output: string | null;
  thumb: string | null;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
}

export interface PropertyDetail {
  property: OrbitPropertyDTO;
  photos: OrbitPhotoDTO[];
  plans: OrbitPlanDTO[];
  jobs: OrbitJobDTO[];
}

export function mediaUrl(rel: string): string {
  return `/api/orbita/media/${rel}`;
}

export function thumbUrl(photo: OrbitPhotoDTO): string {
  return mediaUrl(photo.thumb);
}

/** Mapa de profundidad (PNG) de una foto para el visor 3D del navegador. */
export function depthUrl(propertyId: string, photoId: string): string {
  return `/api/orbita/properties/${propertyId}/photos/${photoId}/depth`;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
  return data;
}

export const orbitApi = {
  listProperties: () =>
    jsonFetch<{ properties: OrbitPropertyDTO[] }>("/api/orbita/properties"),

  createProperty: (name: string, address: string, tone: string) =>
    jsonFetch<{ property: OrbitPropertyDTO }>("/api/orbita/properties", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, address, tone }),
    }),

  deleteProperty: (id: string) =>
    jsonFetch<{ ok: boolean }>(`/api/orbita/properties/${id}`, { method: "DELETE" }),

  createDemo: () =>
    jsonFetch<{ property: OrbitPropertyDTO; created: boolean; photosAdded?: number; failed?: number }>(
      "/api/orbita/demo",
      { method: "POST" },
    ),

  getProperty: (id: string) => jsonFetch<PropertyDetail>(`/api/orbita/properties/${id}`),

  updateProperty: (id: string, data: Partial<Record<string, unknown>>) =>
    jsonFetch<{ property: OrbitPropertyDTO }>(`/api/orbita/properties/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    }),

  ingest: (id: string, form: FormData) =>
    jsonFetch<{ added: number; skipped: number; errors: string[] }>(
      `/api/orbita/properties/${id}/photos`,
      { method: "POST", body: form },
    ),

  reorder: (id: string, order: string[]) =>
    jsonFetch<{ ok: boolean }>(`/api/orbita/properties/${id}/photos`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order }),
    }),

  updatePhoto: (propertyId: string, photoId: string, data: { room?: string; caption?: string }) =>
    jsonFetch<{ photo: OrbitPhotoDTO }>(`/api/orbita/properties/${propertyId}/photos/${photoId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    }),

  deletePhoto: (propertyId: string, photoId: string) =>
    jsonFetch<{ ok: boolean }>(`/api/orbita/properties/${propertyId}/photos/${photoId}`, {
      method: "DELETE",
    }),

  analyze: (id: string, force = false) =>
    jsonFetch<{ analyzed: number; usedVision: boolean; message?: string }>(
      `/api/orbita/properties/${id}/analyze`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force }),
      },
    ),

  direct: (id: string, tone?: string, format?: string) =>
    jsonFetch<{ plan: OrbitPlanDTO; source: string }>(`/api/orbita/properties/${id}/direct`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tone, format }),
    }),

  updatePlan: (id: string, shots: Array<{ photoId: string; move: string; durationMs: number; caption?: string; depth: number }>) =>
    jsonFetch<{ plan: OrbitPlanDTO }>(`/api/orbita/properties/${id}/plan`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shots }),
    }),

  startRender: (id: string, resolution: string, quality: "speed" | "quality" = "quality") =>
    jsonFetch<{ job: OrbitJobDTO }>(`/api/orbita/properties/${id}/render`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resolution, quality }),
    }),

  listJobs: (id: string) =>
    jsonFetch<{ jobs: OrbitJobDTO[] }>(`/api/orbita/properties/${id}/render`),

  analytics: (id: string) =>
    jsonFetch<{
      counts: Record<string, number>;
      daily: Array<{ date: string; views: number; plays: number }>;
      byRef: Record<string, number>;
      total: number;
    }>(`/api/orbita/properties/${id}/analytics`),

  track: (propertyId: string, type: string, ref?: string) =>
    fetch("/api/orbita/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ propertyId, type, ref }),
    }).catch(() => undefined),
};
