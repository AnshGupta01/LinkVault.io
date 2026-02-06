import * as sdk from 'node-appwrite';
import dotenv from 'dotenv';

dotenv.config();

const client = new sdk.Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

export const tablesDB = new sdk.TablesDB(client);
export const storage = new sdk.Storage(client);
export const DATABASE_ID = process.env.DATABASE_ID;
export const TABLE_ID = process.env.TABLE_ID;
export const BUCKET_ID = process.env.BUCKET_ID;
export const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
export const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID;