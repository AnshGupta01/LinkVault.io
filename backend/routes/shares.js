import express from 'express';
import multer from 'multer';
import bcrypt from 'bcrypt';
import * as sdk from 'node-appwrite';
import { tablesDB, storage, DATABASE_ID, TABLE_ID, BUCKET_ID, APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from '../utils/appwrite.js';
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

        const now = new Date();
        const expiresAt = expiryDate ? new Date(expiryDate) : new Date(now.getTime() + 10 * 60 * 1000);

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
                ['read("any")']  // Public read permission
            );

            // Generate the file URLs from Storage API
            const viewUrl = `${APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${fileData.$id}/view?project=${APPWRITE_PROJECT_ID}`;
            const downloadUrl = `${APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${fileData.$id}/download?project=${APPWRITE_PROJECT_ID}`;

            shareData.fileMetadata = {
                fileId: fileData.$id,
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                viewUrl: viewUrl,
                downloadUrl: downloadUrl
            };
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
                await storage.deleteFile(BUCKET_ID, document.fileMetadata.fileId);
            }
            return res.status(410).json({ error: 'Share expired' });
        }

        // Check password
        if (document.password) {
            if (!password) return res.status(401).json({ error: 'Password required', passwordProtected: true });
            const valid = await bcrypt.compare(password, document.password);
            if (!valid) return res.status(401).json({ error: 'Wrong password' });
        }

        // Increment views (update row)
        await tablesDB.updateRow({
            databaseId: DATABASE_ID,
            tableId: TABLE_ID,
            rowId: document.$id,
            data: { currentViews: document.currentViews + 1 }
        });

        // Check one-time/max views
        if (document.oneTimeView || (document.maxViews && document.currentViews >= document.maxViews)) {
            await tablesDB.deleteRow({
                databaseId: DATABASE_ID,
                tableId: TABLE_ID,
                rowId: document.$id
            });
            if (document.fileMetadata) {
                await storage.deleteFile(BUCKET_ID, document.fileMetadata.fileId);
            }
        }

        const response = {
            shareId: document.$id,
            contentType: document.contentType,
            expiresAt: document.expiresAt,
            createdAt: document.$createdAt,
            oneTimeView: document.oneTimeView,
            maxViews: document.maxViews,
            currentViews: document.currentViews + 1
        };

        if (document.contentType === 'text') {
            response.textContent = document.textContent;
        } else {
            // Use stored URLs from TablesDB
            response.fileMetadata = {
                originalName: document.fileMetadata.originalName,
                mimeType: document.fileMetadata.mimeType,
                size: document.fileMetadata.size,
                viewUrl: document.fileMetadata.viewUrl,
                downloadUrl: document.fileMetadata.downloadUrl
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
                await storage.deleteFile(BUCKET_ID, document.fileMetadata.fileId);
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

        // Use stored download URL from TablesDB
        res.redirect(document.fileMetadata.downloadUrl);

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Download failed' });
    }
});

export default router;
