import swaggerJSDoc from "swagger-jsdoc";

const spec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "JamSync API",
      version: "1.0.0",
      description: "JamSync API — documented with swagger-jsdoc.",
    },
    servers: [{ url: "http://localhost:3001" }],
  },

  apis: ["./*.ts"],
});

export default spec;