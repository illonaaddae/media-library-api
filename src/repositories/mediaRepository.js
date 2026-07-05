// repositories/mediaRepository.js — the ONLY layer that touches Mongoose.
// Pure data access: no business logic, no req/res, no throwing AppError.
const Media = require('../models/Media');

// Merge the soft-delete guard into a filter unless the caller opts in to
// include soft-deleted records. Keeps `deletedAt: null` from being forgotten.
function withActiveGuard(filter = {}, { includeDeleted = false } = {}) {
  if (includeDeleted) return { ...filter };
  return { ...filter, deletedAt: null };
}

async function create(data) {
  return Media.create(data);
}

async function insertMany(docs) {
  return Media.insertMany(docs);
}

async function findAll(filter = {}, { skip = 0, limit = 10, sort = {}, includeDeleted = false } = {}) {
  return Media.find(withActiveGuard(filter, { includeDeleted }))
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .exec();
}

async function count(filter = {}, { includeDeleted = false } = {}) {
  return Media.countDocuments(withActiveGuard(filter, { includeDeleted }));
}

async function findById(id, { includeDeleted = false } = {}) {
  return Media.findOne(withActiveGuard({ _id: id }, { includeDeleted })).exec();
}

async function updateById(id, update, { includeDeleted = false } = {}) {
  return Media.findOneAndUpdate(
    withActiveGuard({ _id: id }, { includeDeleted }),
    update,
    { returnDocument: 'after', runValidators: true }
  ).exec();
}

// Soft delete: set deletedAt to now. Only affects currently-active records.
async function softDeleteById(id, deletedAt) {
  return Media.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { deletedAt: deletedAt ?? new Date() },
    { returnDocument: 'after' }
  ).exec();
}

// Restore a soft-deleted record: clear deletedAt.
async function restoreById(id) {
  return Media.findOneAndUpdate(
    { _id: id, deletedAt: { $ne: null } },
    { deletedAt: null },
    { returnDocument: 'after' }
  ).exec();
}

// Hard delete: remove the document entirely (used for the default DELETE).
async function hardDeleteById(id) {
  return Media.findOneAndDelete({ _id: id }).exec();
}

module.exports = {
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
