// repositories/mediaRepository.ts — the ONLY layer that touches Mongoose.
// Pure data access: no business logic, no req/res, no throwing AppError.
import { QueryFilter, SortOrder, UpdateQuery } from 'mongoose';
import Media, { IMedia, MediaDocument } from '../models/Media';

interface GuardOptions {
  includeDeleted?: boolean;
}

interface FindAllOptions extends GuardOptions {
  skip?: number;
  limit?: number;
  sort?: Record<string, SortOrder>;
}

// Merge the soft-delete guard into a filter unless the caller opts in to
// include soft-deleted records. Keeps `deletedAt: null` from being forgotten.
function withActiveGuard(
  filter: QueryFilter<IMedia> = {},
  { includeDeleted = false }: GuardOptions = {}
): QueryFilter<IMedia> {
  if (includeDeleted) return { ...filter };
  return { ...filter, deletedAt: null };
}

async function create(data: Partial<IMedia>): Promise<MediaDocument> {
  return Media.create(data);
}

async function insertMany(docs: Partial<IMedia>[]): Promise<MediaDocument[]> {
  // insertMany infers a structurally-looser doc type than the hydrated model
  // document; the runtime shape is identical, so narrow it back.
  return (await Media.insertMany(docs)) as unknown as MediaDocument[];
}

async function findAll(
  filter: QueryFilter<IMedia> = {},
  { skip = 0, limit = 10, sort = {}, includeDeleted = false }: FindAllOptions = {}
): Promise<MediaDocument[]> {
  return Media.find(withActiveGuard(filter, { includeDeleted }))
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .exec();
}

async function count(
  filter: QueryFilter<IMedia> = {},
  { includeDeleted = false }: GuardOptions = {}
): Promise<number> {
  return Media.countDocuments(withActiveGuard(filter, { includeDeleted }));
}

async function findById(
  id: string,
  { includeDeleted = false }: GuardOptions = {}
): Promise<MediaDocument | null> {
  return Media.findOne(withActiveGuard({ _id: id }, { includeDeleted })).exec();
}

async function updateById(
  id: string,
  update: UpdateQuery<IMedia>,
  { includeDeleted = false }: GuardOptions = {}
): Promise<MediaDocument | null> {
  return Media.findOneAndUpdate(
    withActiveGuard({ _id: id }, { includeDeleted }),
    update,
    { returnDocument: 'after', runValidators: true }
  ).exec();
}

// Soft delete: set deletedAt to now. Only affects currently-active records.
async function softDeleteById(
  id: string,
  deletedAt?: Date
): Promise<MediaDocument | null> {
  return Media.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { deletedAt: deletedAt ?? new Date() },
    { returnDocument: 'after' }
  ).exec();
}

// Restore a soft-deleted record: clear deletedAt.
async function restoreById(id: string): Promise<MediaDocument | null> {
  return Media.findOneAndUpdate(
    { _id: id, deletedAt: { $ne: null } },
    { deletedAt: null },
    { returnDocument: 'after' }
  ).exec();
}

// Hard delete: remove the document entirely (used for the default DELETE).
async function hardDeleteById(id: string): Promise<MediaDocument | null> {
  return Media.findOneAndDelete({ _id: id }).exec();
}

export default {
  create,
  insertMany,
  findAll,
  count,
  findById,
  updateById,
  softDeleteById,
  restoreById,
  hardDeleteById,
};
