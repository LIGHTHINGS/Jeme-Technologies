'use strict';

const axios  = require('axios');
const config = require('../config');

// Accepts both spaced ("In Review") and underscored ("in_review") variants.
const KYC_STATUS_MAP = {
  'none':        'none',
  'pending':     'pending',
  'in_progress': 'in_progress',
  'bvn':         'bvn',
  'nin':         'nin',
  'bvn_nin':     'bvn_nin',
  'completed':   'complete',
  'failed':      'failed',
};


class OdooClient {
  constructor() {
    this._uid  = null;
    this._http = axios.create({
      baseURL: config.odoo.url,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Authenticate against Odoo and cache the user ID.
  // Uses the stateless /jsonrpc endpoint so no session cookie is needed.
  async _authenticate() {
    const response = await this._http.post('/jsonrpc', {
      jsonrpc: '2.0',
      method:  'call',
      id:      1,
      params:  {
        service: 'common',
        method:  'authenticate',
        args:    [config.odoo.db, config.odoo.username, config.odoo.apiKey, {}],
      },
    });

    const uid = response.data?.result;
    if (!uid) {
      throw new Error('Odoo authentication failed. Verify your credentials in .env');
    }

    this._uid = uid;
  }

  // Wraps every Odoo model call. Re-authenticates once if the session has expired.
  async _execute(model, method, args = [], kwargs = {}) {
    if (!this._uid) await this._authenticate();

    const payload = () => ({
      jsonrpc: '2.0',
      method:  'call',
      id:      Date.now(),
      params:  {
        service: 'object',
        method:  'execute_kw',
        args:    [config.odoo.db, this._uid, config.odoo.apiKey, model, method, args, kwargs],
      },
    });

    let response = await this._http.post('/jsonrpc', payload());

    // If the session expired or auth was rejected, retry once after re-auth.
    if (response.data?.error?.code === 100) {
      await this._authenticate();
      response = await this._http.post('/jsonrpc', payload());
    }

    if (response.data?.error) {
      const msg = response.data.error.data?.message || JSON.stringify(response.data.error);
      throw new Error(msg);
    }

    return response.data.result;
  }

  // Search for records matching a domain and return the requested fields.
  async search(model, domain, { fields = ['id'], limit = 1, order } = {}) {
    const kwargs = { fields, limit };
    if (order) kwargs.order = order;
    return this._execute(model, 'search_read', [domain], kwargs);
  }

  // Create a single record and return its new ID.
  async create(model, values) {
    return this._execute(model, 'create', [values]);
  }

  // Update one or more records by ID.
  async write(model, ids, values) {
    return this._execute(model, 'write', [ids, values]);
  }
}

// Single shared instance — one authenticated session for the lifetime of the process.
const odoo = new OdooClient();

module.exports = { odoo, KYC_STATUS_MAP };
