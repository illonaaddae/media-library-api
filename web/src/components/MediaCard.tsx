import { useState } from 'react';
import type { Media } from '../types';
import { CAT_ICON, fileUrl, formatDate, formatSize, imageUrl } from '../format';

interface Props {
  media: Media;
  onEdit: (m: Media) => void;
  onDelete: (m: Media) => void;
}

export default function MediaCard({ media, onEdit, onDelete }: Props) {
  const [broken, setBroken] = useState(false);
  const src = imageUrl(media);
  const showImg = src && !broken;
  const href = fileUrl(media);

  return (
    <div className="media">
      <a
        className="thumb"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title="Open full file in a new tab"
      >
        {showImg ? (
          <img src={src} alt={media.title} onError={() => setBroken(true)} />
        ) : (
          <div className="ph">{CAT_ICON[media.category]}</div>
        )}
        <span className="thumb-view">View</span>
      </a>
      <div className="body">
        <div className="title">{media.title}</div>
        <div>
          <span className={`badge cat-${media.category}`}>{media.category}</span>
        </div>
        <div className="tags">
          {media.tags.map((t) => (
            <span className="tag" key={t}>
              #{t}
            </span>
          ))}
        </div>
        <div className="meta">
          {formatSize(media.fileSize)} · {formatDate(media.createdAt)}
        </div>
      </div>
      <div className="actions">
        <button className="ghost" onClick={() => onEdit(media)}>
          Edit
        </button>
        <button className="danger" onClick={() => onDelete(media)}>
          Delete
        </button>
      </div>
    </div>
  );
}
