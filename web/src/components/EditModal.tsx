import { useState } from 'react';
import { api } from '../api';
import { CATEGORIES, type Media } from '../types';

interface Props {
  media: Media;
  onClose: () => void;
  onSaved: () => void;
  notify: (message: string, type?: 'ok' | 'err') => void;
}

export default function EditModal({ media, onClose, onSaved, notify }: Props) {
  const [title, setTitle] = useState(media.title);
  const [category, setCategory] = useState<string>(media.category);
  const [tags, setTags] = useState(media.tags.join(', '));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.update(media._id, { title, category, tags });
      notify('Updated');
      onSaved();
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Update failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card modal">
        <h2>Edit media</h2>
        <div className="row">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="row">
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="row">
          <label>Tags (comma-separated)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
        <div className="foot">
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
