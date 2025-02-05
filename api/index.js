const express = require('express');
const { queryDocs } = require('../retrieval/da-qa');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());  // Enable CORS for all routes

// Streaming query endpoint
app.post('/api/query', async (req, res) => {
    const { question } = req.body;

    if (!question) {
        return res.status(400).json({ error: 'Question is required' });
    }

    try {
        // Set headers for Server-Sent Events (SSE)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();  // Flush headers to establish the connection

        // Query documents and stream the response
        await queryDocs(question, res);
    } catch (error) {
        console.error("Error in /api/query endpoint:", error);
        res.write(`event: error\ndata: ${JSON.stringify({ error: "An error occurred while processing your request." })}\n\n`);
        res.end();
    }
});

// Start the server
const PORT = process.env.PORT || 5500;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
