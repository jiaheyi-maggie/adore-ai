import { createClient } from '@supabase/supabase-js';
import type {
  WardrobeItem,
  ItemAttributes,
  PaginatedResponse,
  ApiResponse,
  ApiError,
} from '@adore/shared';

// ── Supabase client (for auth only in mobile) ──────────────

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── API base URL ────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// ── Helpers ─────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
  });

  const json = await res.json();

  if (!res.ok || json.error) {
    const err = json.error ?? { code: 'UNKNOWN', message: `Request failed: ${res.status}` };
    throw new Error(err.message);
  }

  return json as T;
}

// ── Wardrobe Items API ──────────────────────────────────────

export interface ListItemsParams {
  category?: string;
  status?: string;
  cursor?: string;
  limit?: number;
}

export async function listItems(
  params: ListItemsParams = {}
): Promise<PaginatedResponse<WardrobeItem>> {
  const searchParams = new URLSearchParams();
  if (params.category) searchParams.set('category', params.category);
  if (params.status) searchParams.set('status', params.status);
  if (params.cursor) searchParams.set('cursor', params.cursor);
  if (params.limit) searchParams.set('limit', String(params.limit));

  const qs = searchParams.toString();
  return apiFetch<PaginatedResponse<WardrobeItem>>(
    `/wardrobe/items${qs ? `?${qs}` : ''}`
  );
}

export async function getItem(id: string): Promise<ApiResponse<WardrobeItem>> {
  return apiFetch<ApiResponse<WardrobeItem>>(`/wardrobe/items/${id}`);
}

export async function createItem(
  item: Record<string, unknown>
): Promise<ApiResponse<WardrobeItem>> {
  return apiFetch<ApiResponse<WardrobeItem>>('/wardrobe/items', {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

export async function updateItem(
  id: string,
  updates: Record<string, unknown>
): Promise<ApiResponse<WardrobeItem>> {
  return apiFetch<ApiResponse<WardrobeItem>>(`/wardrobe/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteItem(id: string): Promise<ApiResponse<WardrobeItem>> {
  return apiFetch<ApiResponse<WardrobeItem>>(`/wardrobe/items/${id}`, {
    method: 'DELETE',
  });
}

// ── Upload API ──────────────────────────────────────────────

export async function uploadImage(
  imageUri: string
): Promise<{ path: string; public_url: string }> {
  const authHeaders = await getAuthHeaders();

  // Read the file as a blob
  const response = await fetch(imageUri);
  const blob = await response.blob();

  const formData = new FormData();
  // React Native's FormData accepts { uri, type, name } objects
  formData.append('image', {
    uri: imageUri,
    type: blob.type || 'image/jpeg',
    name: `photo-${Date.now()}.jpg`,
  } as unknown as Blob);

  const res = await fetch(`${API_URL}/wardrobe/items/upload`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      // Don't set Content-Type — let FormData set the multipart boundary
    },
    body: formData,
  });

  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? 'Upload failed');
  }
  return json.data;
}

// ── Background Removal API ──────────────────────────────────

export async function removeBackground(
  imageUrl: string
): Promise<{ original_url: string; clean_url: string }> {
  const result = await apiFetch<
    ApiResponse<{ original_url: string; clean_url: string }>
  >('/wardrobe/items/remove-background', {
    method: 'POST',
    body: JSON.stringify({ image_url: imageUrl }),
  });
  return result.data;
}

// ── Scan API ────────────────────────────────────────────────

export async function scanItem(
  imageUrl: string
): Promise<ItemAttributes> {
  const result = await apiFetch<ApiResponse<ItemAttributes>>(
    '/wardrobe/items/scan',
    {
      method: 'POST',
      body: JSON.stringify({ image_url: imageUrl }),
    }
  );
  return result.data;
}
