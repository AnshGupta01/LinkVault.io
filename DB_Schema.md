# Database Schema

This project uses Appwrite TablesDB for share metadata and Appwrite Storage for file binaries. A single `shares` table holds both text and file shares; files are stored in a Storage bucket and referenced by metadata in the table.

## TablesDB: `shares`

```json
{
  "$id": "String", // Appwrite row ID (auto-generated)
  "contentType": "String", // "text" or "file"
  "textContent": "String", // Text content (null for file shares)
  "fileMetadata": "String", // JSON string: { fileId, originalName, mimeType, size, viewUrl, downloadUrl }
  "password": "String", // Hashed password (null if not protected)
  "oneTimeView": "Boolean", // Self-destruct after first view
  "maxViews": "Number", // Optional view limit
  "currentViews": "Number", // Current view count
  "expiresAt": "String", // ISO 8601 timestamp
  "$createdAt": "String", // Appwrite timestamp
  "$updatedAt": "String" // Appwrite timestamp
}
```

## Storage Bucket

- Stores uploaded files.
- Public read access is used for share links.
- `fileMetadata` keeps the Storage `fileId` and prebuilt view/download URLs.

## Usage Summary

- **Create share**: write a row in `shares`; if a file is uploaded, store it in the bucket and save its metadata JSON into `fileMetadata`.
- **Read share**: fetch the row by `$id`, verify password (if set), enforce `expiresAt`, and increment `currentViews`.
- **One-time or max views**: delete the row (and file, if any) when `oneTimeView` is true or `currentViews` reaches `maxViews`.
- **Cleanup**: a cron job queries rows where `expiresAt` is in the past and removes the row plus any associated Storage file.
