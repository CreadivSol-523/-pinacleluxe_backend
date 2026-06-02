const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "PinacleLuxe Backend API",
    version: "1.0.0",
    description: "Swagger documentation for the PinacleLuxe backend API.",
  },
  servers: [
    {
      url: "http://localhost:5000/api",
      description: "Local API server",
    },
  ],
  tags: [
    { name: "Auth", description: "Authentication, login, and session endpoints" },
    { name: "User", description: "User profile and account management endpoints" },
    { name: "Category", description: "Category management APIs" },
    { name: "Product", description: "Product management APIs" },
    { name: "Region", description: "Region management APIs" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          error: { type: "string" },
        },
      },
      AuthRequest: {
        type: "object",
        properties: {
          identifier: { type: "string" },
          password: { type: "string" },
          deviceId: { type: "string" },
        },
      },
      RegisterRequest: {
        type: "object",
        properties: {
          username: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          password: { type: "string" },
          deviceId: { type: "string" },
          role: { type: "string", enum: ["Admin", "User"] },
        },
      },
      MessageResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new admin or send OTP for user signup",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterRequest" },
            },
          },
        },
        responses: {
          201: { description: "Created" },
          400: { description: "Bad Request" },
        },
      },
    },
    "/login": {
      post: {
        tags: ["Auth"],
        summary: "Login and receive access and refresh tokens",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AuthRequest" },
            },
          },
        },
        responses: {
          200: { description: "OK" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Token refresh endpoint",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  token: { type: "string" },
                  deviceId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "OK" },
          403: { description: "Forbidden" },
        },
      },
    },
    "/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout and invalidate refresh token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  token: { type: "string" },
                  deviceId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "OK" },
          400: { description: "Bad Request" },
        },
      },
    },
    "/forget-password": {
      post: {
        tags: ["Auth"],
        summary: "Request an OTP for signup or password reset",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  identifier: { type: "string" },
                  type: { type: "string", enum: ["signup", "otp"] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "OTP sent" },
        },
      },
    },
    "/verify-otp": {
      post: {
        tags: ["Auth"],
        summary: "Verify OTP for signup or password reset",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  identifier: { type: "string" },
                  otp: { type: "string" },
                  type: { type: "string", enum: ["signup", "otp"] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Verified" },
        },
      },
    },
    "/change-password": {
      post: {
        tags: ["Auth"],
        summary: "Reset user password using OTP",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  identifier: { type: "string" },
                  otp: { type: "string" },
                  newPassword: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Password changed" },
        },
      },
    },
    "/profile/{id}": {
      get: {
        tags: ["User"],
        summary: "Get user or admin profile by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "OK" },
          404: { description: "Not Found" },
        },
      },
    },
    "/update-profile/{id}": {
      patch: {
        tags: ["User"],
        summary: "Update profile by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  username: { type: "string" },
                  phone: { type: "string" },
                  country: { type: "string" },
                  city: { type: "string" },
                  oldPassword: { type: "string" },
                  newPassword: { type: "string" },
                  profilePicture: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "OK" },
        },
      },
    },
    "/get-users": {
      get: {
        tags: ["User"],
        summary: "List users with optional search and pagination",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 10 } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: { 200: { description: "OK" } },
      },
    },
    "/category": {
      post: {
        tags: ["Category"],
        summary: "Create a new category",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  isActive: { type: "boolean" },
                  parentId: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Created" } },
      },
      get: {
        tags: ["Category"],
        summary: "List categories",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 10 } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "isActive", in: "query", schema: { type: "boolean" } },
          { name: "parentId", in: "query", schema: { type: "string" } },
        ],
        responses: { 200: { description: "OK" } },
      },
    },
    "/category/{id}": {
      get: {
        tags: ["Category"],
        summary: "Get category by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "OK" } },
      },
      put: {
        tags: ["Category"],
        summary: "Update category by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  isActive: { type: "boolean" },
                  parentId: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "OK" } },
      },
      delete: {
        tags: ["Category"],
        summary: "Delete category by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Deleted" } },
      },
    },
    "/product": {
      post: {
        tags: ["Product"],
        summary: "Create a new product",
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  basePrice: { type: "number" },
                  categories: { type: "array", items: { type: "string" } },
                  isVariable: { type: "boolean" },
                  discountMode: { type: "string" },
                  discountValue: { type: "number" },
                  stock: { type: "number" },
                  badge: { type: "string" },
                  description: { type: "string" },
                  productImages: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Created" } },
      },
      get: {
        tags: ["Product"],
        summary: "List products",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 10 } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "category", in: "query", schema: { type: "string" } },
        ],
        responses: { 200: { description: "OK" } },
      },
    },
    "/product/{id}": {
      get: {
        tags: ["Product"],
        summary: "Get product by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "OK" } },
      },
      put: {
        tags: ["Product"],
        summary: "Update product",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  basePrice: { type: "number" },
                  badge: { type: "string" },
                  isVariable: { type: "boolean" },
                  discountMode: { type: "string" },
                  discountValue: { type: "number" },
                  stock: { type: "number" },
                  categories: { type: "array", items: { type: "string" } },
                  productImages: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "OK" } },
      },
      delete: {
        tags: ["Product"],
        summary: "Delete product by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Deleted" } },
      },
    },
    "/region": {
      post: {
        tags: ["Region"],
        summary: "Create a new region",
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { code: { type: "string" }, name: { type: "string" }, currency: { type: "string" }, description: { type: "string" }, isActive: { type: "boolean" } } }
            },
          },
        },
        responses: { 201: { description: "Created" } },
      },
      get: {
        tags: ["Region"],
        summary: "List regions",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "isActive", in: "query", schema: { type: "boolean" } },
        ],
        responses: { 200: { description: "OK" } },
      },
    },
    "/region/{id}": {
      get: {
        tags: ["Region"],
        summary: "Get region by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "OK" } },
      },
      put: {
        tags: ["Region"],
        summary: "Update region by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { name: { type: "string" }, code: { type: "string" }, currency: { type: "string" }, description: { type: "string" }, isActive: { type: "boolean" } } }
            },
          },
        },
        responses: { 200: { description: "OK" } },
      },
      delete: {
        tags: ["Region"],
        summary: "Delete region by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Deleted" } },
      },
    },
  },
};

export default swaggerSpec;
