# JOBHUB Backend

Backend API for JOBHUB, built with Express and MongoDB. The current project is an early-stage foundation that includes application configuration, MongoDB lifecycle management, Cloudinary file operations, mail and JWT utilities, centralized error handling, and graceful shutdown.

## Tech stack

- Node.js with ES modules
- Express 5
- MongoDB and Mongoose
- Cloudinary for file storage
- Multer and `file-type` for uploads and content-based file validation
- Nodemailer for SMTP email
- JSON Web Tokens and bcrypt
- ESLint

## Prerequisites

Before running the API, install or create access to:

- Node.js 20 or later
- Yarn 1.x
- MongoDB
- A Cloudinary account
- An SMTP account

The server verifies both MongoDB and Cloudinary during startup. It will stop if either service cannot be reached or if a required environment variable is missing.

## Getting started

1. Install dependencies:

   ```bash
   yarn install
   ```

2. Create your local environment file:

   ```bash
   cp .env.example .env
   ```

3. Fill in every value in `.env`. A development configuration looks like this:

   ```dotenv
   NODE_ENV=development
   PORT=8000

   MONGODB_URI=mongodb://127.0.0.1:27017/jobhub
   MONGODB_SERVER_SELECTION_TIMEOUT_MS=10000

   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret

   BYTES_PER_MEGABYTE=1048576
   MAX_FILE_SIZE_MB=10

   JWT_SECRET=replace-with-a-long-random-secret
   JWT_EXPIRES_IN=15m
   JWT_ALGORITHM=HS256
   JWT_INVITE_SECRET=replace-with-another-long-random-secret
   JWT_INVITE_EXPIRES_IN=24h

   BCRYPT_SALT_ROUNDS=10

   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=replace-with-a-secure-password

   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-smtp-username
   SMTP_PASS=your-smtp-password
   MAIL_FROM_NAME=JobHub Admin
   ```

   Do not commit `.env`; it is already ignored by Git. For Gmail SMTP, use an app password rather than your normal account password.

4. Start the development server:

   ```bash
   yarn dev
   ```

   The API is available at `http://localhost:8000` unless you change `PORT`.

## Available scripts

| Command | Description |
| --- | --- |
| `yarn dev` | Start the server with Nodemon and reload on file changes |
| `yarn start` | Start the server with Node.js |
| `yarn lint` | Check the codebase with ESLint |
| `yarn lint:fix` | Automatically fix supported ESLint issues |

## API endpoints

| Method | Endpoint | Environment | Description |
| --- | --- | --- | --- |
| `GET` | `/api/` | All | Health-style hello-world response |
| `POST` | `/api/files/test-upload` | Non-production only | Upload one image or PDF to Cloudinary |
| `DELETE` | `/api/files/test-delete` | Non-production only | Delete a Cloudinary asset by public ID |

### Check the API

```bash
curl http://localhost:8000/api/
```

Example response:

```json
{
  "success": true,
  "message": "Hello World",
  "timestamp": 1775472000000
}
```

### Upload a test file

Send a `multipart/form-data` request with a single field named `file`:

```bash
curl -X POST \
  -F "file=@/path/to/file.pdf" \
  http://localhost:8000/api/files/test-upload
```

Accepted file types are JPEG, PNG, WebP, and PDF. Validation uses the file contents rather than trusting the supplied MIME type. The maximum size is controlled by `MAX_FILE_SIZE_MB`.

The response includes the Cloudinary `publicId`, `resourceType`, and `deliveryType`; keep these values if you want to delete the asset later.

### Delete a test file

```bash
curl -X DELETE \
  -H "Content-Type: application/json" \
  -d '{
    "publicId": "cloudinary-public-id",
    "resourceType": "image",
    "deliveryType": "upload"
  }' \
  http://localhost:8000/api/files/test-delete
```

Use the values returned by the upload endpoint. `resourceType` defaults to `image` and `deliveryType` defaults to `upload` when omitted.

File test routes are intentionally disabled when `NODE_ENV=production`.

## Error responses

Errors use a consistent JSON shape:

```json
{
  "error": {
    "message": "Route not found"
  }
}
```

In non-production environments, error responses also include a stack trace. Uploads that exceed the configured limit return `413`, unsupported file types return `415`, and unknown routes return `404`.

## Project structure

```text
.
├── index.js                    # Startup and graceful shutdown
├── src
│   ├── app.js                  # Express application
│   ├── config                  # Environment, MongoDB, Cloudinary, and SMTP
│   ├── constants               # Shared enums and allowed file types
│   ├── controllers             # HTTP request handlers
│   ├── database                # Seed scaffolding
│   ├── middlewares             # Upload, validation, 404, and error handling
│   ├── models                  # Mongoose model exports
│   ├── routes                  # API route definitions
│   ├── services                # File and mail services
│   └── utils                   # JWT, password, and application error helpers
├── .env.example
├── eslint.config.js
└── package.json
```

## Production notes

- Set `NODE_ENV=production` to hide stack traces and disable test file routes.
- Store secrets in your deployment platform's secret manager, not in source control.
- The process handles `SIGINT` and `SIGTERM`, closes the HTTP server, and disconnects MongoDB before exiting.
- Run the service behind HTTPS and a production process/container supervisor.

## License

This project is licensed under the MIT License, as declared in `package.json`.
