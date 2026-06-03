'use strict';

require('dotenv').config();

const REQUIRED = ['ODOO_URL', 'ODOO_DB', 'ODOO_USERNAME', 'ODOO_API_KEY', 'API_SECRET_TOKEN'];

for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`[Config] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,

  apiSecretToken: process.env.API_SECRET_TOKEN,

  odoo: {
    url:      process.env.ODOO_URL.replace(/\/$/, ''),
    db:       process.env.ODOO_DB,
    username: process.env.ODOO_USERNAME,
    apiKey:   process.env.ODOO_API_KEY,
    fields: {
      kycStatus:    process.env.ODOO_KYC_STATUS_FIELD    || 'x_kyc',
      customerType: process.env.ODOO_CUSTOMER_TYPE_FIELD || 'x_customer_type',
    },
  },
};
