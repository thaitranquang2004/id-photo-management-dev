const crypto = require('node:crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function ipHash(req) {
  return sha256(req.ip || 'unknown');
}

module.exports = { sha256, ipHash };
