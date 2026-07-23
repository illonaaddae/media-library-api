// Integration tests: the five media endpoints over the real HTTP + Mongoose
// stack (Supertest on the exported app, mongodb-memory-server from setup.ts).
// Uploads land in the test UPLOAD_DIR and are cleaned up in afterAll.
import path from 'path';
import fs from 'fs';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import Media from '../../models/Media';
import config from '../../config/env';

const JPEG = path.join(__dirname, '../fixtures/pixel.jpg');
const TXT = path.join(__dirname, '../fixtures/note.txt');

// Seed a media record directly (bypassing upload) with all required fields.
async function seedMedia(overrides: Record<string, unknown> = {}) {
  return Media.create({
    title: 'seed',
    category: 'image',
    filePath: 'uploads_test/seed.jpg',
    originalName: 'seed.jpg',
    mimeType: 'image/jpeg',
    fileSize: 123,
    ...overrides,
  });
}

afterAll(() => {
  // Uploaded files/thumbnails go to a temp dir — remove it after the suite.
  fs.rmSync(config.uploadDir, { recursive: true, force: true });
});

describe('POST /media', () => {
  it('201 creates a record from a valid upload', async () => {
    const res = await request(app)
      .post('/media')
      .field('title', 'Sunset')
      .field('category', 'image')
      .attach('file', JPEG);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toMatchObject({
      title: 'Sunset',
      category: 'image',
      originalName: 'pixel.jpg',
      mimeType: 'image/jpeg',
    });
    expect(res.body.data._id).toBeDefined();
  });

  it('400 when title is missing — details names the field', async () => {
    const res = await request(app)
      .post('/media')
      .field('category', 'image')
      .attach('file', JPEG);

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.details.map((d: { field: string }) => d.field)).toContain('title');
  });

  it('400 on an unsupported file type', async () => {
    const res = await request(app)
      .post('/media')
      .field('title', 'A doc')
      .field('category', 'document')
      .attach('file', TXT);

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toMatch(/unsupported file type/i);
  });

  it('201 accepts a video file (video/mp4)', async () => {
    const res = await request(app)
      .post('/media')
      .field('title', 'Demo clip')
      .field('category', 'video')
      .attach('file', JPEG, { filename: 'clip.mp4', contentType: 'video/mp4' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.category).toBe('video');
    expect(res.body.data.mimeType).toBe('video/mp4');
    // No thumbnail is generated for non-image types.
    expect(res.body.data.thumbnailPath).toBeNull();
  });
});

describe('GET /media', () => {
  it('returns arithmetically-correct pagination metadata after seeding', async () => {
    // Seed 12 records; page size 5 -> 3 pages.
    await Promise.all(
      Array.from({ length: 12 }, (_, i) => seedMedia({ title: `item-${i}` }))
    );

    const res = await request(app).get('/media').query({ page: 1, limit: 5 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.pagination).toEqual({
      total: 12,
      page: 1,
      limit: 5,
      totalPages: 3, // Math.ceil(12 / 5)
    });
    expect(res.body.data.results).toHaveLength(5);
  });

  it('filters by category', async () => {
    await seedMedia({ title: 'a', category: 'image' });
    await seedMedia({ title: 'b', category: 'document' });
    await seedMedia({ title: 'c', category: 'document' });

    const res = await request(app).get('/media').query({ category: 'document' });

    expect(res.status).toBe(200);
    expect(res.body.data.pagination.total).toBe(2);
    expect(
      res.body.data.results.every((m: { category: string }) => m.category === 'document')
    ).toBe(true);
  });

  it('matches title with ?search', async () => {
    await seedMedia({ title: 'apple' });
    await seedMedia({ title: 'banana' });

    const res = await request(app).get('/media').query({ search: 'apple' });

    expect(res.status).toBe(200);
    expect(res.body.data.pagination.total).toBe(1);
    expect(res.body.data.results[0].title).toBe('apple');
  });
});

describe('GET /media/:id', () => {
  it('200 for an existing record', async () => {
    const doc = await seedMedia({ title: 'findme' });

    const res = await request(app).get(`/media/${doc._id}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data._id).toBe(String(doc._id));
  });

  it('404 for a valid but absent id', async () => {
    const absent = new mongoose.Types.ObjectId().toString();

    const res = await request(app).get(`/media/${absent}`);

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toBeDefined();
  });

  it('400 for a malformed id', async () => {
    const res = await request(app).get('/media/not-a-valid-id');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });
});

describe('PUT /media/:id', () => {
  it('200 on a valid update', async () => {
    const doc = await seedMedia({ title: 'old' });

    const res = await request(app).put(`/media/${doc._id}`).send({ title: 'new' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.title).toBe('new');
  });

  it('400 on an invalid (empty) body', async () => {
    const doc = await seedMedia();

    const res = await request(app).put(`/media/${doc._id}`).send({});

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });
});

describe('DELETE /media/:id', () => {
  it('200 on a successful delete', async () => {
    const doc = await seedMedia();

    const res = await request(app).delete(`/media/${doc._id}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.deleted).toBe(String(doc._id));
  });

  it('404 when deleting an absent id', async () => {
    const absent = new mongoose.Types.ObjectId().toString();

    const res = await request(app).delete(`/media/${absent}`);

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
  });
});

describe('soft delete + restore', () => {
  it('soft-deletes then restores a record', async () => {
    const doc = await seedMedia();

    const del = await request(app).delete(`/media/${doc._id}`).query({ soft: 'true' });
    expect(del.status).toBe(200);
    expect(del.body.data.soft).toBe(true);

    const restore = await request(app).post(`/media/${doc._id}/restore`);
    expect(restore.status).toBe(200);
    expect(restore.body.status).toBe('success');
    expect(restore.body.data.deletedAt).toBeNull();
  });
});

describe('POST /media/bulk', () => {
  it('201 creates multiple records sharing metadata', async () => {
    const res = await request(app)
      .post('/media/bulk')
      .field('title', 'Batch')
      .field('category', 'image')
      .attach('files', JPEG)
      .attach('files', JPEG);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveLength(2);
  });
});

describe('unknown route', () => {
  it('404 with the error envelope', async () => {
    const res = await request(app).get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toMatch(/not found/i);
  });
});
