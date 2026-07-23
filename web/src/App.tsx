import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { CATEGORIES, type Media, type Pagination } from './types';
import HealthBadge from './components/HealthBadge';
import UploadForm from './components/UploadForm';
import MediaCard from './components/MediaCard';
import EditModal from './components/EditModal';

interface Toast {
  id: number;
  message: string;
  type: 'ok' | 'err';
}

const LIMIT = 8;

export default function App() {
  const [items, setItems] = useState<Media[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: LIMIT, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('createdAt:desc');
  const [editing, setEditing] = useState<Media | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const notify = useCallback((message: string, type: 'ok' | 'err' = 'ok') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const load = useCallback(async () => {
    const [sortBy, order] = sort.split(':');
    try {
      const data = await api.list({ page, limit: LIMIT, search, category, sortBy, order });
      setItems(data.results);
      setPagination(data.pagination);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load media', 'err');
    }
  }, [page, search, category, sort, notify]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce the search box.
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const del = async (m: Media) => {
    if (!window.confirm(`Delete “${m.title}”?`)) return;
    try {
      await api.remove(m._id);
      notify('Deleted');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Delete failed', 'err');
    }
  };

  return (
    <>
      <header>
        <span className="logo">🎬</span>
        <h1>Media Library</h1>
        <HealthBadge />
      </header>

      <main>
        <UploadForm
          onUploaded={() => {
            setPage(1);
            load();
          }}
          notify={notify}
        />

        <div className="toolbar">
          <div className="field">
            <label>Search title</label>
            <input value={searchInput} placeholder="Search…" onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <div className="field">
            <label>Category</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Sort</label>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              <option value="createdAt:desc">Newest</option>
              <option value="createdAt:asc">Oldest</option>
              <option value="title:asc">Title A–Z</option>
              <option value="fileSize:desc">Largest</option>
            </select>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="empty">No media yet — upload something above.</div>
        ) : (
          <div className="grid-gallery">
            {items.map((m) => (
              <MediaCard key={m._id} media={m} onEdit={setEditing} onDelete={del} />
            ))}
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="pagination">
            <button className="ghost" disabled={pagination.page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← Prev
            </button>
            <span>
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} items
            </span>
            <button
              className="ghost"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </main>

      {editing && (
        <EditModal media={editing} onClose={() => setEditing(null)} onSaved={load} notify={notify} />
      )}

      <div className="toasts">
        {toasts.map((t) => (
          <div className={`toast ${t.type}`} key={t.id}>
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}
