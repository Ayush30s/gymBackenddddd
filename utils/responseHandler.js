function sendResponse(
  res,
  statusCode,
  { success, message = null, error = null, debug = null, data = null }
) {
  return res.status(statusCode).json({
    success,
    message,
    error: error
      ? process.env.NODE_ENV === "development"
        ? error.stack || error.message || error.toString()
        : undefined
      : null,
    debug,
    data,
  });
}

module.exports = sendResponse;
