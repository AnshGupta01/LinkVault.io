import cron from 'node-cron';
import * as sdk from 'node-appwrite';
import { tablesDB, storage, DATABASE_ID, TABLE_ID, BUCKET_ID } from './appwrite.js';

cron.schedule('*/5 * * * *', async () => {
    console.log('Running Appwrite cleanup...');

    try {
        const now = new Date().toISOString();
        const expired = await tablesDB.listRows({
            databaseId: DATABASE_ID,
            tableId: TABLE_ID,
            queries: [sdk.Query.lessThan('expiresAt', now)]
        });

        for (const doc of expired.rows) {
            await tablesDB.deleteRow({
                databaseId: DATABASE_ID,
                tableId: TABLE_ID,
                rowId: doc.$id
            });

            if (doc.fileMetadata) {
                try {
                    await storage.deleteFile(BUCKET_ID, doc.fileMetadata.fileId);
                } catch (e) {
                    console.log('File already deleted:', doc.fileMetadata.fileId);
                }
            }
        }

        console.log(`Cleaned ${expired.total} expired shares`);
    } catch (error) {
        console.error('Cleanup error:', error);
    }
});

const startCleanupJob = () => {
    console.log('Appwrite cleanup job scheduled (runs every 5 minutes)');
};

export default startCleanupJob;
