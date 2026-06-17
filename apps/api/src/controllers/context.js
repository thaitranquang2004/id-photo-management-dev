function requestContext(req) {
  return {
    user: req.user || null,
    ip: req.ip,
    userAgent: req.get('user-agent')
  };
}

module.exports = { requestContext };
