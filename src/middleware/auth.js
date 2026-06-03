'use strict';

const { apiSecretToken } = require('../config');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  const token = header.slice(7);

  if (!token || token !== apiSecretToken) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  next();
}

module.exports = { authenticate };
