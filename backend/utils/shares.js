import express from 'express';
import multer from 'multer';
import bcrypt from 'bcrypt';
import * as sdk from 'node-appwrite';
import { tablesDB, storage, DATABASE_ID, TABLE_ID, BUCKET_ID, APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from './appwrite.js';
import { InputFile } from 'node-appwrite/file';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024 } });

// POST /api/upload
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { text, expiryDate, password, oneTimeView, maxViews } = req.body;
        const file = req.file;

        if (!text && !file) return res.status(400).json({ error: 'Either text or file required' });
        if (text && file) return res.status(400).json({ error: 'Only one of text or file' });

        // Validate text content
        if (text && !text.trim()) return res.status(400).json({ error: 'Text cannot be empty' });

        // Validate password
        if (password && password.trim().length < 3) return res.status(400).json({ error: 'Password must be at least 3 characters' });

        // Validate maxViews
        if (maxViews) {
            const views = parseInt(maxViews);
            if (isNaN(views) || views < 1) return res.status(400).json({ error: 'maxViews must be a positive number' });
        }

        const now = new Date();
        const expiresAt = expiryDate ? new Date(expiryDate) : new Date(now.getTime() + 10 * 60 * 1000);

        // Validate expiry date is in the future
        if (expiryDate && expiresAt <= now) {
            return res.status(400).json({ error: 'Expiry date must be in the future' });
        }

        let hashedPassword = null;
        if (password?.trim()) hashedPassword = await bcrypt.hash(password, 10);

        const shareData = {
            contentType: file ? 'file' : 'text',
            textContent: text || null,
            fileMetadata: null,
            password: hashedPassword,
            oneTimeView: oneTimeView === 'true',
            maxViews: maxViews ? parseInt(maxViews) : null,
            currentViews: 0,
            expiresAt: expiresAt.toISOString()
        };

        if (file) {
            const inputFile = InputFile.fromBuffer(file.buffer, file.originalname);

            const fileData = await storage.createFile(
                BUCKET_ID,
                'unique()',
                inputFile,
                ['read("any")']
            );

            const viewUrl = `${APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${fileData.$id}/view?project=${APPWRITE_PROJECT_ID}`;
            const downloadUrl = `${APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${fileData.$id}/download?project=${APPWRITE_PROJECT_ID}`;

            shareData.fileMetadata = JSON.stringify({
                fileId: fileData.$id,
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                viewUrl: viewUrl,
                downloadUrl: downloadUrl
            });
        }

        const row = await tablesDB.createRow({
            databaseId: DATABASE_ID,
            tableId: TABLE_ID,
            rowId: 'unique()',
            data: shareData,
            permissions: [sdk.Permission.read(sdk.Role.any())]
        });

        res.status(201).json({
            success: true,
            shareId: row.$id,
            shareUrl: `${process.env.FRONTEND_URL}/share/${row.$id}`,
            expiresAt: expiresAt.toISOString()
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed', details: error.message });
    }
});

// GET /api/share/:shareId
router.get('/share/:shareId', async (req, res) => {
    try {
        const { shareId } = req.params;
        const { password } = req.query;

        let document;
        try {
            document = await tablesDB.getRow({
                databaseId: DATABASE_ID,
                tableId: TABLE_ID,
                rowId: shareId
            });
        } catch (error) {
            if (error.code === 404) {
                return res.status(404).json({ error: 'Share not found or expired' });
            }
            throw error;
        }

        // Check expiry
        if (new Date() > new Date(document.expiresAt)) {
            await tablesDB.deleteRow({
                databaseId: DATABASE_ID,
                tableId: TABLE_ID,
                rowId: document.$id
            });
            if (document.fileMetadata) {
                const fileMetadata = JSON.parse(document.fileMetadata);
                await storage.deleteFile(BUCKET_ID, fileMetadata.fileId);
            }
            return res.status(410).json({ error: 'Share expired' });
        }

        // Check password
        if (document.password) {
            if (!password) return res.status(401).json({ error: 'Password required', passwordProtected: true });
            const valid = await bcrypt.compare(password, document.password);
            if (!valid) return res.status(401).json({ error: 'Wrong password' });
        }

        // For file shares, count views on download to avoid deleting before download.
        let newViewCount = document.currentViews;
        if (document.contentType === 'text') {
            newViewCount = document.currentViews + 1;

            // Increment views (update row)
            await tablesDB.updateRow({
                databaseId: DATABASE_ID,
                tableId: TABLE_ID,
                rowId: document.$id,
                data: { currentViews: newViewCount }
            });

            // Check one-time/max views using the NEW count
            if (document.oneTimeView || (document.maxViews && newViewCount >= document.maxViews)) {
                await tablesDB.deleteRow({
                    databaseId: DATABASE_ID,
                    tableId: TABLE_ID,
                    rowId: document.$id
                });
                if (document.fileMetadata) {
                    const fileMetadata = JSON.parse(document.fileMetadata);
                    await storage.deleteFile(BUCKET_ID, fileMetadata.fileId);
                }
            }
        }

        const response = {
            shareId: document.$id,
            contentType: document.contentType,
            expiresAt: document.expiresAt,
            createdAt: document.$createdAt,
            oneTimeView: document.oneTimeView,
            maxViews: document.maxViews,
            currentViews: newViewCount
        };

        if (document.contentType === 'text') {
            response.textContent = document.textContent;
        } else {
            // Parse stored JSON fileMetadata
            const fileMetadata = JSON.parse(document.fileMetadata);
            response.fileMetadata = {
                originalName: fileMetadata.originalName,
                mimeType: fileMetadata.mimeType,
                size: fileMetadata.size,
                viewUrl: fileMetadata.viewUrl,
                downloadUrl: fileMetadata.downloadUrl
            };
        }

        res.json(response);

    } catch (error) {
        console.error('Share retrieval error:', error);
        res.status(500).json({ error: 'Failed to retrieve share' });
    }
});

// GET /download/:shareId
router.get('/download/:shareId', async (req, res) => {
    try {
        const { shareId } = req.params;
        const { password } = req.query;

        let document;
        try {
            document = await tablesDB.getRow({
                databaseId: DATABASE_ID,
                tableId: TABLE_ID,
                rowId: shareId
            });
        } catch (error) {
            if (error.code === 404) {
                return res.status(404).json({ error: 'Share not found' });
            }
            throw error;
        }

        // Check expiry
        if (new Date() > new Date(document.expiresAt)) {
            await tablesDB.deleteRow({
                databaseId: DATABASE_ID,
                tableId: TABLE_ID,
                rowId: document.$id
            });
            if (document.fileMetadata) {
                const fileMetadata = JSON.parse(document.fileMetadata);
                await storage.deleteFile(BUCKET_ID, fileMetadata.fileId);
            }
            return res.status(410).json({ error: 'Share expired' });
        }

        // Check password
        if (document.password) {
            if (!password) return res.status(401).json({ error: 'Password required' });
            const valid = await bcrypt.compare(password, document.password);
            if (!valid) return res.status(401).json({ error: 'Wrong password' });
        }

        if (document.contentType !== 'file') {
            return res.status(400).json({ error: 'Not a file share' });
        }

        // Increment views on download for file shares
        const newViewCount = document.currentViews + 1;
        await tablesDB.updateRow({
            databaseId: DATABASE_ID,
            tableId: TABLE_ID,
            rowId: document.$id,
            data: { currentViews: newViewCount }
        });

        // Use stored download URL from TablesDB
        const fileMetadata = JSON.parse(document.fileMetadata);
        const downloadUrl = fileMetadata.downloadUrl;

        // If one-time or max views reached, delete after redirect to allow download
        if (document.oneTimeView || (document.maxViews && newViewCount >= document.maxViews)) {
            setTimeout(async () => {
                try {
                    await tablesDB.deleteRow({
                        databaseId: DATABASE_ID,
                        tableId: TABLE_ID,
                        rowId: document.$id
                    });
                    await storage.deleteFile(BUCKET_ID, fileMetadata.fileId);
                } catch (cleanupError) {
                    console.error('Post-download cleanup error:', cleanupError);
                }
            }, 2000);
        }

        res.redirect(downloadUrl);

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Download failed' });
    }
});

export default router;
