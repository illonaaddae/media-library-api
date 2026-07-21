// Unit test: mediaService with the repository mocked via jest.mock() — this is
// what makes these UNIT tests: no database is touched, only the service logic.
import mediaService from '../../services/mediaService';
import mediaRepository from '../../repositories/mediaRepository';
import AppError from '../../utils/AppError';
import type { MediaQuery } from '../../schemas/mediaSchemas';

// Replace the repository module with automatic mocks.
jest.mock('../../repositories/mediaRepository');
const repo = mediaRepository as jest.Mocked<typeof mediaRepository>;

const baseQuery: MediaQuery = {
  page: 1,
  limit: 10,
  sortBy: 'createdAt',
  order: 'desc',
};

describe('mediaService.listMedia', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns the exact pagination metadata shape with correct totalPages (84/10 -> 9)', async () => {
    const results = [{ _id: 'a' }, { _id: 'b' }] as never;
    repo.findAll.mockResolvedValue(results);
    repo.count.mockResolvedValue(84);

    const out = await mediaService.listMedia(baseQuery);

    expect(out.pagination).toEqual({
      total: 84,
      page: 1,
      limit: 10,
      totalPages: 9, // Math.ceil(84 / 10)
    });
    expect(out.results).toBe(results);
  });

  it('queries the page and the count together (Promise.all path)', async () => {
    repo.findAll.mockResolvedValue([] as never);
    repo.count.mockResolvedValue(0);

    const out = await mediaService.listMedia(baseQuery);

    expect(repo.findAll).toHaveBeenCalledTimes(1);
    expect(repo.count).toHaveBeenCalledTimes(1);
    // 0 results -> Math.ceil(0 / 10) === 0 in our implementation.
    expect(out.pagination).toEqual({
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
  });
});

describe('mediaService.getMediaById', () => {
  afterEach(() => jest.clearAllMocks());

  it('throws a 404 AppError when the record is absent', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(mediaService.getMediaById('653d1f2a4b1c2d3e4f5a6b7c')).rejects.toBeInstanceOf(
      AppError
    );
    await expect(
      mediaService.getMediaById('653d1f2a4b1c2d3e4f5a6b7c')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
