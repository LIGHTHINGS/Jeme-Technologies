'use strict';

require('dotenv').config();

const express        = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const { port }       = require('./config');
const customerRoutes = require('./routes/customer');
const config = require('./config');

const app = express();

app.use(express.json());


// Health check — useful for uptime monitoring and deployment verification.
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Customer Sync API Docs',
  swaggerOptions: {
    persistAuthorization: true, // keeps JWT token across page refreshes
  },
}));

app.use('/api/customer', customerRoutes);


// 404 — catches any path that didn't match a route above.
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found.' });
});

// Global error handler — last-resort catch for anything unhandled.
app.use((err, _req, res, _next) => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({ success: false, error: 'An unexpected error occurred.' });
});


if (require.main === module) {
  // Only starts a local server when run directly (node src/index.js)
  app.listen(port, () => {
    console.log(`[Server] running on port ${port}`);
    console.log(`[Server] environment: ${config.environment}`);
    console.log(`[Server] API docs available at http://localhost:${port}/api-docs`);
  });
}
