// src/tests/setup.ts — global test harness.
// Starts an in-memory MongoDB so tests never touch dev data, cleans every
// collection between tests, and tears the server down at the end. Registered
// via jest.config.js `setupFilesAfterEnv`.
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongo: MongoMemoryServer;

// Generous timeout: the first run downloads the mongod binary, and each start
// spawns a real mongod process — both exceed Jest's 5s hook default.
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}, 120_000);

// Wipe every collection after each test to keep tests isolated.
afterEach(async () => {
  const { collections } = mongoose.connection;
  for (const name of Object.keys(collections)) {
    await collections[name].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
}, 120_000);
