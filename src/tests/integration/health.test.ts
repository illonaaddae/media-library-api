// Integration test: GET /health over the real HTTP stack (Supertest on the
// exported app). No DB dependency — it must stay green even without Mongo.
import request from 'supertest';
import app from '../../app';

describe('GET /health', () => {
  it('returns 200 with status ok, a numeric uptime, and an ISO timestamp', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(typeof res.body.timestamp).toBe('string');
    // The timestamp is a valid ISO-8601 string (round-trips through Date).
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });
});
