import express from 'express';
import multer from 'multer';
import bcrypt from 'bcrypt';
import * as sdk from 'node-appwrite';
import { tablesDB, storage, DATABASE_ID, TABLE_ID, BUCKET_ID, APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from './appwrite.js';
import { InputFile } from 'node-appwrite/file';

const router = express.Router();

// Blacklist of dangerous file types
const BLOCKED_MIME_TYPES = [
    'application/x-msdownload',
    'application/x-msdos-program',
    'application/x-executable',
    'application/x-elf',
    'application/x-sh',
    'application/x-shellscript',
    'application/x-bat',
    'text/x-shellscript',
    'application/x-perl',
    'application/x-python'
];

const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.com', '.scr', '.vbs', '.cpl', '.msi', '.sh', '.bash', '.zsh', '.fish'];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024 } });

router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { text, expiryDate, password, oneTimeView, maxViews } = req.body;
        const file = req.file;

        if (!text && !file) return res.status(400).json({ error: 'Either text or file required' });
        if (text && file) return res.status(400).json({ error: 'Only one of text or file' });
        if (text && !text.trim()) return res.status(400).json({ error: 'Text cannot be empty' });
        if (password && password.trim().length < 3) return res.status(400).json({ error: 'Password must be at least 3 characters' });
        if (maxViews) {
            const views = parseInt(maxViews);
            if (isNaN(views) || views < 1) return res.status(400).json({ error: 'maxViews must be a positive number' });
        }

        // File type validation
        if (file) {
            const fileExt = file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase();
            if (BLOCKED_EXTENSIONS.includes(fileExt) || BLOCKED_MIME_TYPES.includes(file.mimetype)) {
                return res.status(400).json({ error: `File type '${fileExt}' is not allowed for security reasons` });
            }
        }

        const now = new Date();
        const expiresAt = expiryDate ? new Date(expiryDate) : new Date(now.getTime() + 10 * 60 * 1000);

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
                await storage.deleteFile({ bucketId: BUCKET_ID, fileId: fileMetadata.fileId });
            }
            return res.status(410).json({ error: 'Share expired' });
        }

        // Check password
        if (document.password) {
            if (!password) return res.status(401).json({ error: 'Password required', passwordProtected: true });
            const valid = await bcrypt.compare(password, document.password);
            if (!valid) return res.status(401).json({ error: 'Wrong password' });
        }

        let newViewCount = document.currentViews;
        if (document.contentType === 'text') {
            newViewCount = document.currentViews + 1;

            await tablesDB.updateRow({
                databaseId: DATABASE_ID,
                tableId: TABLE_ID,
                rowId: document.$id,
                data: { currentViews: newViewCount }
            });

            if (document.oneTimeView || (document.maxViews && newViewCount >= document.maxViews)) {
                await tablesDB.deleteRow({
                    databaseId: DATABASE_ID,
                    tableId: TABLE_ID,
                    rowId: document.$id
                });
                if (document.fileMetadata) {
                    const fileMetadata = JSON.parse(document.fileMetadata);
                    await storage.deleteFile({ bucketId: BUCKET_ID, fileId: fileMetadata.fileId });
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
            currentViews: newViewCount,
            passwordProtected: !!document.password
        };

        if (document.contentType === 'text') {
            response.textContent = document.textContent;
        } else {
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

        const newViewCount = document.currentViews + 1;
        await tablesDB.updateRow({
            databaseId: DATABASE_ID,
            tableId: TABLE_ID,
            rowId: document.$id,
            data: { currentViews: newViewCount }
        });

        const fileMetadata = JSON.parse(document.fileMetadata);
        const downloadUrl = fileMetadata.downloadUrl;

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

router.delete('/share/:shareId', async (req, res) => {
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

        // Check password if required
        if (document.password) {
            if (!password) return res.status(401).json({ error: 'Password required' });
            const valid = await bcrypt.compare(password, document.password);
            if (!valid) return res.status(401).json({ error: 'Wrong password' });
        }

        // Delete from database
        await tablesDB.deleteRow({
            databaseId: DATABASE_ID,
            tableId: TABLE_ID,
            rowId: document.$id
        });

        // Delete file if it exists
        if (document.fileMetadata) {
            try {
                const fileMetadata = JSON.parse(document.fileMetadata);
                await storage.deleteFile({ bucketId: BUCKET_ID, fileId: fileMetadata.fileId });
            } catch (e) {
                console.log('File already deleted:', e.message);
            }
        }

        res.json({
            success: true,
            message: 'Share deleted successfully',
            shareId: document.$id
        });

    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Failed to delete share' });
    }
});

export default router;
