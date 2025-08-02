const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger.json');

/**
 * Configure and initialize Swagger documentation
 * @param {Express} app - Express application
 */
module.exports = function setupSwagger(app) {
  // Configure custom options for Swagger UI
  const options = {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "AI Document Reader API Documentation",
    customfavIcon: ""
  };

  // Serve Swagger UI at /api-docs
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, options));

  // Expose the Swagger spec as JSON at /api-docs.json
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}; 