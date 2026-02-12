import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import shareRoutes from './utils/shares.js';
import startCleanupJob from './utils/cleanup.js';

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const localhostRegex = /^http:\/\/localhost:\d+$/;
const loopbackRegex = /^http:\/\/127\.0\.0\.1:\d+$/;
const allowedOrigins = [localhostRegex, loopbackRegex];

if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', shareRoutes);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: err.message
    });
});

startCleanupJob();
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Appwrite connection configured');
});
