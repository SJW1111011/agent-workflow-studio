function createHttpError(statusCode, message, options = {}) {
  const error = new Error(message);
  error.statusCode = normalizeStatusCode(statusCode, 500);

  if (typeof options.code === "string" && options.code.trim()) {
    error.code = options.code.trim();
  }

  return error;
}

function badRequest(message, code) {
  return createHttpError(400, message, { code });
}

function notFound(message, code) {
  return createHttpError(404, message, { code });
}

function conflict(message, code) {
  return createHttpError(409, message, { code });
}

function getHttpStatusCode(error, fallback = 500) {
  return normalizeStatusCode(error && error.statusCode, fallback);
}

function normalizeStatusCode(value, fallback) {
  return Number.isInteger(value) && value >= 400 && value <= 599 ? value : fallback;
}

module.exports = {
  badRequest,
  conflict,
  createHttpError,
  getHttpStatusCode,
  notFound,
};
