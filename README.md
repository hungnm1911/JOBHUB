# JOBHUB

JOBHUB is an early-stage full-stack job platform built with React, Express, and MongoDB. The repository currently provides a Vite-powered frontend scaffold and a backend foundation with configuration validation, database lifecycle management, Cloudinary file operations, email and authentication utilities, centralized error handling, and graceful shutdown.

> [!NOTE]
> The product UI, job workflows, authentication endpoints, and frontend-to-backend integration are not implemented yet. The current frontend displays the default starter screen, while the backend exposes a health-style endpoint and development-only file test routes.

## Repository status

| Area | Current state |
| --- | --- |
| Frontend | React/Vite scaffold with hot module replacement and ESLint |
| API | Express server with a hello-world endpoint and centralized errors |
| Database | MongoDB connection and shutdown lifecycle; application models are not implemented |
| File storage | Cloudinary connection plus development-only upload/delete test endpoints |
| Authentication | JWT and password utilities exist; authentication routes are not implemented |
| Email | SMTP transport and mail service utilities exist; product email flows are not implemented |

## Tech stack

### Frontend

- React 19
- Vite 8
- CSS
- ESLint

### Backend

- Node.js with ES modules
- Express 5
- MongoDB and Mongoose
- Cloudinary, Multer, and `file-type`
- Nodemailer
- JSON Web Tokens and bcrypt
- Zod
- Socket.IO dependencies (real-time features are not implemented yet)
- ESLint

## Project structure

```text
JOBHUB/
├── backend/
│   ├── index.js                 # API startup and graceful shutdown
│   ├── src/
│   │   ├── config/              # Environment, MongoDB, Cloudinary, and SMTP
│   │   ├── constants/           # Shared file, token, and folder constants
│   │   ├── controllers/         # HTTP request handlers
│   │   ├── database/            # Seed scaffolding
│   │   ├── middlewares/         # Upload, validation, 404, and error handling
│   │   ├── models/              # Mongoose model exports
│   │   ├── routes/              # API routes
│   │   ├── services/            # File and mail services
│   │   └── utils/               # JWT, password, and application error helpers
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── public/                  # Static assets
│   ├── src/                     # React application and styles
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## Prerequisites

- Node.js 20 or later
- Yarn 1.x
- A running MongoDB instance or MongoDB Atlas connection
- A Cloudinary account
- SMTP credentials

The backend validates every environment variable and verifies its MongoDB and Cloudinary connections before it starts listening. It exits on startup if the configuration is incomplete or either service cannot be reached.

## Getting started

### 1. Clone the repository

```bash
git clone <repository-url>
cd JOBHUB
```

### 2. Configure and start the backend

```bash
cd backend
yarn install
cp .env.example .env
```

Fill in every value in `backend/.env`. A development configuration has this shape:

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

Do not commit `.env`. For Gmail SMTP, use an app password instead of your normal account password.

Start the API:

```bash
yarn dev
```

The default API address is `http://localhost:8000`.

### 3. Start the frontend

In a second terminal, from the repository root:

```bash
cd frontend
yarn install
yarn dev
```

Vite prints the local development URL, which is `http://localhost:5173` by default. The frontend does not currently call the backend, so no frontend API environment variable or proxy is required yet.

## Available scripts

Run each command from the relevant application directory.

| Directory | Command | Description |
| --- | --- | --- |
| `backend` | `yarn dev` | Start the API with Nodemon and reload on changes |
| `backend` | `yarn start` | Start the API with Node.js |
| `backend` | `yarn lint` | Check backend code with ESLint |
| `backend` | `yarn lint:fix` | Fix supported backend lint issues |
| `frontend` | `yarn dev` | Start the Vite development server |
| `frontend` | `yarn build` | Create a production frontend build in `dist/` |
| `frontend` | `yarn preview` | Preview the production build locally |
| `frontend` | `yarn lint` | Check frontend code with ESLint |

There is no automated test suite configured yet.

## API reference

| Method | Endpoint | Availability | Description |
| --- | --- | --- | --- |
| `GET` | `/api/` | All environments | Return a hello-world health-style response |
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

Send one `multipart/form-data` field named `file`:

```bash
curl -X POST \
  -F "file=@/path/to/file.pdf" \
  http://localhost:8000/api/files/test-upload
```

Accepted content types are JPEG, PNG, WebP, and PDF. The API validates the file contents, not only the supplied MIME type. The upload limit is controlled by `MAX_FILE_SIZE_MB`.

Keep the returned `publicId`, `resourceType`, and `deliveryType` values if you want to delete the asset afterward.

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

`resourceType` defaults to `image` and `deliveryType` defaults to `upload` when omitted. Both file test routes are disabled when `NODE_ENV=production`.

## Error responses

API errors use a consistent JSON structure:

```json
{
  "error": {
    "message": "Route not found"
  }
}
```

Non-production responses also include a stack trace. Oversized uploads return `413`, unsupported file types return `415`, and unknown routes return `404`.

## Production notes

- Set `NODE_ENV=production` to hide error stack traces and disable file test routes.
- Keep secrets in your deployment platform's secret manager.
- Serve the API behind HTTPS and a production process or container supervisor.
- The backend handles `SIGINT` and `SIGTERM`, closes the HTTP server, and disconnects from MongoDB before exiting.
- Configure the frontend's eventual API base URL and cross-origin policy before deploying the two applications separately.

## More documentation

- [Backend documentation](backend/README.md)
- [Frontend documentation](frontend/README.md)

## License

The backend package declares the MIT license in `backend/package.json`. Add a root `LICENSE` file before distributing the complete project under that license.
