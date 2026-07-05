// utils/apiResponse.js — consistent success envelope helper.
// Always emits { status: "success", data }. Errors go through errorHandler.
function sendSuccess(res, statusCode, data) {
  return res.status(statusCode).json({ status: 'success', data });
}

module.exports = { sendSuccess };
