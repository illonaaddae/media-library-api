import type { Media, MediaList } from './types';

interface ErrorDetail {
  field: string;
  message: string;
}
interface Envelope<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  details?: ErrorDetail[];
}

// Unwrap the API's { status, data } envelope, throwing a readable Error (with
// field-level validation details flattened) on failure.
async function unwrap<T>(res: Response): Promise<T> {
  const json = (await res.json()) as Envelope<T>;
  if (!res.ok || json.status !== 'success') {
    const detail = json.details?.map((d) => `${d.field}: ${d.message}`).join(', ');
    throw new Error(detail || json.message || `Request failed (${res.status})`);
  }
  return json.data as T;
}

export interface ListParams {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  sortBy: string;
  order: string;
}

export interface UpdateBody {
  title: string;
  category: string;
  tags: string;
}

export const api = {
  async list(params: ListParams): Promise<MediaList> {
    const q = new URLSearchParams({
      page: String(params.page),
      limit: String(params.limit),
      sortBy: params.sortBy,
      order: params.order,
    });
    if (params.search) q.set('search', params.search);
    if (params.category) q.set('category', params.category);
    return unwrap<MediaList>(await fetch(`/media?${q.toString()}`));
  },

  async upload(form: FormData): Promise<Media> {
    return unwrap<Media>(await fetch('/media', { method: 'POST', body: form }));
  },

  async update(id: string, body: UpdateBody): Promise<Media> {
    return unwrap<Media>(
      await fetch(`/media/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    );
  },

  async remove(id: string): Promise<void> {
    await unwrap<{ deleted: string }>(await fetch(`/media/${id}`, { method: 'DELETE' }));
  },

  async health(): Promise<{ status: string; uptime: number }> {
    const res = await fetch('/health');
    return (await res.json()) as { status: string; uptime: number };
  },
};
