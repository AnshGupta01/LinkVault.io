# LinkVault Backend

A secure, link-based content sharing backend built with Node.js, Express, and Appwrite. Users can upload text or files and receive shareable links with optional password protection, expiry dates, and view limits.

## Project Overview

LinkVault is a Pastebin-like application that allows users to:

- Share text snippets or files securely via unique links
- Set password protection on shares
- Configure expiry times (default 10 minutes)
- Limit the number of views
- Enable one-time view access
- Automatic cleanup of expired content via background jobs

## Setup Instructions

### Prerequisites

- Node.js v20+
- npm
- Appwrite Cloud account or self-hosted Appwrite instance
- Created Database and Table in Appwrite
- Created Storage bucket in Appwrite

### Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Create `.env` file:**

   ```bash
   cp .env.example .env
   ```

3. **Start the server:**

   ```bash
   npm run dev      # Development with nodemon
   npm run start    # Production
   ```

   Server runs on `http://localhost:5000`

## API Overview

### Health Check

**GET** `/health`

Returns server status.

```bash
curl http://localhost:5000/health
```

Response:

```json
{
  "status": "ok",
  "timestamp": "2026-02-06T09:30:00.000Z"
}
```

### Upload Content

**POST** `/api/upload`

Upload text or file (not both).

**Request:**

```bash
# Text upload
curl -X POST http://localhost:5000/api/upload \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your text here",
    "password": "optional_password",
    "expiryDate": "2026-02-06T10:00:00Z",
    "oneTimeView": false,
    "maxViews": null
  }'

# File upload
curl -X POST http://localhost:5000/api/upload \
  -F "file=@document.pdf" \
  -F "password=optional_password" \
  -F "oneTimeView=false" \
  -F "maxViews=null"
```

**Response (201):**

```json
{
  "success": true,
  "shareId": "6985b13458018b0e5a81",
  "shareUrl": "http://localhost:5173/share/6985b13458018b0e5a81",
  "expiresAt": "2026-02-06T09:40:31.201Z"
}
```

**Parameters:**

- `text` (string, optional): Plain text content
- `file` (file, optional): File to upload
- `password` (string, optional): Password protection
- `expiryDate` (ISO string, optional): Custom expiry time (default: now + 10 minutes)
- `oneTimeView` (boolean, optional): Auto-delete after first view
- `maxViews` (number, optional): Auto-delete after N views

### Retrieve Share

**GET** `/api/share/:shareId`

Retrieve share content. Increments view count.

```bash
curl http://localhost:5000/api/share/6985b13458018b0e5a81?password=optional_password
```

**Response (200):**

_Text share:_

```json
{
  "shareId": "6985b13458018b0e5a81",
  "contentType": "text",
  "textContent": "Your text here",
  "expiresAt": "2026-02-06T09:40:31.201Z",
  "createdAt": "2026-02-06T09:30:32.361Z",
  "oneTimeView": false,
  "maxViews": null,
  "currentViews": 1
}
```

_File share:_

```json
{
  "shareId": "6985b13458018b0e5a82",
  "contentType": "file",
  "fileMetadata": {
    "originalName": "document.pdf",
    "mimeType": "application/pdf",
    "size": 1048576,
    "viewUrl": "https://sgp.cloud.appwrite.io/v1/storage/buckets/.../view?project=...",
    "downloadUrl": "https://sgp.cloud.appwrite.io/v1/storage/buckets/.../download?project=..."
  },
  "expiresAt": "2026-02-06T09:40:31.201Z",
  "createdAt": "2026-02-06T09:30:32.361Z",
  "oneTimeView": false,
  "maxViews": null,
  "currentViews": 1
}
```

**Error Responses:**

- `404`: Share not found or expired
- `410`: Share expired
- `401`: Password required or incorrect
- `400`: Invalid request

### Download File

**GET** `/api/download/:shareId`

Redirect to file download URL. Validates password and expiry before redirecting.

```bash
curl http://localhost:5000/api/download/6985b13458018b0e5a82?password=optional_password
```

Response: Redirect (302) to Appwrite storage download URL

## Design Decisions

### 1. **Text vs File Storage Strategy**

- **Text**: Stored directly in TablesDB for fast retrieval
- **Files**: Stored in Appwrite Storage; URLs are pre-generated and cached in TablesDB
- **Rationale**: Separates large binary data from structured data, optimizes query performance

### 2. **ID Generation**

- Uses Appwrite's auto-generated `rowId` as the share identifier
- Hard-to-guess format: 20-character alphanumeric IDs
- No manual ID management needed

### 3. **Password Protection**

- Passwords hashed with bcrypt (10 salt rounds) before storage
- Never stored in plain text
- Compared at retrieval time

### 4. **View Counting**

- Incremented on every successful retrieval (post-validation)
- Atomic updates via TablesDB
- Auto-deletion triggers after reaching `maxViews` or on one-time view

### 5. **Expiry Mechanism**

- Two-layer approach:
  - **On-access**: Checked during retrieval, immediately deleted if expired
  - **Background job**: Cron job runs every 5 minutes to clean up expired shares
- Rationale: Ensures timely deletion without depending solely on access patterns

### 6. **File URLs**

- Generated at upload time using Appwrite endpoint format
- Stored in TablesDB for consistency
- Pre-signed URLs not used (files are publicly readable via permissions)
- Frontend receives ready-to-use URLs

### 7. **Error Handling**

- Proper HTTP status codes (400, 401, 404, 410, 500)
- Detailed error messages without exposing internals
- Try-catch blocks with logging for debugging

## Project Structure

```
backend/
├── appwrite.js          # Appwrite SDK initialization
├── server.js            # Express app setup
├── package.json         # Dependencies
├── .env                 # Configuration (not in git)
├── .env.example         # Example env file
├── .gitignore           # Git ignore rules
├── routes/
│   └── shares.js        # Share API endpoints
├── jobs/
│   └── cleanup.js       # Background cleanup job
└── README.md           # This file
```

## Assumptions & Limitations

### Assumptions

1. **Appwrite is the source of truth** for all data and file storage
2. **Frontend URL is fixed** at deployment; CORS is configured accordingly
3. **Database and storage buckets** are already created in Appwrite
4. **API is called from the configured FRONTEND_URL** only (CORS restriction)

### Limitations

1. **No authentication**: Currently anyone can upload and share
   - Solution: Add JWT auth via Appwrite Sessions
2. **No user accounts**: No way to track who uploaded what
   - Solution: Integrate Appwrite Auth
3. **No analytics**: No view history or access logs
   - Solution: Add separate logs table
4. **File size limited to 50MB** (configurable via `MAX_FILE_SIZE`)
   - Appwrite cloud may have additional limits
5. **Cleanup job is best-effort**: Relies on server uptime
   - TTL indexes in traditional databases could complement this
6. **No rate limiting**: Vulnerable to abuse
   - Solution: Implement express-rate-limit middleware

## Environment Variables

| Variable                 | Description                  | Example                            |
| ------------------------ | ---------------------------- | ---------------------------------- |
| `PORT`                   | Server port                  | `5000`                             |
| `FRONTEND_URL`           | Frontend URL for share links | `http://localhost:5173`            |
| `APPWRITE_ENDPOINT`      | Appwrite API endpoint        | `https://sgp.cloud.appwrite.io/v1` |
| `APPWRITE_PROJECT_ID`    | Appwrite project ID          | `698598890000aa8a9e05`             |
| `APPWRITE_API_KEY`       | Appwrite API key             | `standard_c280...`                 |
| `DATABASE_ID`            | Appwrite database ID         | `698598c50020be23efc9`             |
| `TABLE_ID`               | Appwrite table ID            | `shares`                           |
| `BUCKET_ID`              | Appwrite storage bucket ID   | `69859ab5001c39ddfe1c`             |
| `MAX_FILE_SIZE`          | Max upload size in bytes     | `52428800` (50MB)                  |
| `DEFAULT_EXPIRY_MINUTES` | Default expiry time          | `10`                               |

## Dependencies

- **express**: Web framework
- **multer**: File upload handling
- **bcrypt**: Password hashing
- **node-appwrite**: Appwrite SDK
- **dotenv**: Environment variable management
- **node-cron**: Background job scheduling
- **nanoid**: Utility (currently unused, but available for custom IDs)
- **cors**: Cross-origin resource sharing


## Testing

### Quick API Tests

```bash
# Health check
curl http://localhost:5000/health

# Upload text
curl -X POST http://localhost:5000/api/upload \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello World"}'

# Retrieve share (replace ID)
curl http://localhost:5000/api/share/{shareId}

# Upload with password
curl -X POST http://localhost:5000/api/upload \
  -H "Content-Type: application/json" \
  -d '{"text":"Secret","password":"mypass"}'

# Access password-protected share
curl http://localhost:5000/api/share/{shareId}?password=mypass
```

## Author 
```bash
Ansh Gupta
Mtech CSE, IIT Kharagpur

# linkedin.com/in/anshexe
# Built in Design Lab 2026
```