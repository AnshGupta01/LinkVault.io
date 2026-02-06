import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import shareRoutes from './utils/shares.js';
import startCleanupJob from './utils/cleanup.js';

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// CORS configuration - flexible for dev, strict for production
const corsOrigin = NODE_ENV === 'development' 
    ? /^http:\/\/localhost:\d+$/ // Allow any localhost port in dev
    : process.env.FRONTEND_URL || 'http://localhost:5173'; // Strict in production

// Middleware
app.use(cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', shareRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: err.message
    });
});

// Start cleanup job
startCleanupJob();

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Appwrite connection configured');
});
