// swagger.js
const swaggerJsdoc = require('swagger-jsdoc');
const config = require('./config');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Customer Management API',
      version: '1.0.0',
      description: 'API for managing customers in Odoo CRM system with integration to partner and lead management',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port || 3000}`,
        description: 'Development server',
      },
      {
        url: 'https://api.example.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Bearer token authentication (applied to all customer endpoints)',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // Path to the API docs (where your JSDoc comments are)
  apis: ['./src/routes/*.js'], // Adjust path to match your routes folder
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;