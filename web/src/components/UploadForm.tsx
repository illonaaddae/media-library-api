import { useRef, useState } from 'react';
import { api } from '../api';
import { CATEGORIES } from '../types';

interface Props {
  onUploaded: () => void;
  notify: (message: string, type?: 'ok' | 'err') => void;
}

export default function UploadForm({ onUploaded, notify }: Props) {
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    try {
      const media = await api.upload(new FormData(e.currentTarget));
      notify(`Uploaded “${media.title}”`);
      formRef.current?.reset();
      setFileName('');
      onUploaded();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Upload failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card upload">
      <h2>Upload media</h2>
      <form className="grid" ref={formRef} onSubmit={submit}>
        <div>
          <label>Title</label>
          <input name="title" required placeholder="e.g. Sunset over Accra" />
        </div>
        <div>
          <label>Category</label>
          <select name="category" required defaultValue="image">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="full">
          <label>Tags (comma-separated)</label>
          <input name="tags" placeholder="beach, travel" />
        </div>
        <div className="full">
          <label>File</label>
          <label className="dropzone">
            <input
              type="file"
              name="file"
              required
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
            />
            <span className="dz-icon">⬆</span>
            <span className="dz-main">{fileName || 'Click to choose a file, or drop it here'}</span>
            <span className="dz-hint">jpeg, png or pdf, up to 5MB</span>
          </label>
        </div>
        <div className="full">
          <button type="submit" disabled={busy}>
            {busy ? <span className="spinner" /> : null} {busy ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </form>
    </section>
  );
}
