const { Pinecone } = require('@pinecone-database/pinecone');
const axios = require('axios');
const { OpenAIEmbeddings } = require('@langchain/openai');
require('dotenv').config();

// Initialize Pinecone
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.Index(process.env.INDEX_NAME);

// OpenAI Embedding Setup
const embedModel = "text-embedding-3-small";

// Generate streaming OpenAI response
async function queryDocs(question, res) {
    try {
        // Step 1: Generate embeddings for the question
        const embeddingResponse = await axios.post(
            "https://api.openai.com/v1/embeddings",
            { input: question, model: embedModel },
            { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
        );
        const queryVector = embeddingResponse.data.data[0].embedding;

        // Step 2: Query Pinecone for relevant documents
        const retrievalResults = await index.query({
            vector: queryVector,
            topK: 3,  // Retrieve top 3 most relevant documents
            includeMetadata: true
        });

        // Step 3: Prepare context from retrieved documents
        let context = "";
        for (const match of retrievalResults.matches) {
            context += `${match.metadata.title}\nURL: ${match.metadata.url}\nContent: ${match.metadata.content}\n\n`;
        }

        // Step 4: Create OpenAI prompt
        const prompt = `
        You are a helpful assistant for developer documentation. Use the following context to answer the question. Include relevant documentation URLs in your response:

        Context:
        ${context}

        Question: ${question}

        Answer:
        `;

        // Step 5: Call OpenAI API with streaming enabled
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }],
                stream: true
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
                },
                responseType: "stream"
            }
        );

        // Step 6: Stream OpenAI response to the client
        response.data.on("data", (chunk) => {
            const lines = chunk.toString().trim().split("\n");

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    try {
                        if (line === "data: [DONE]") {
                            // End the stream when "[DONE]" is received
                            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                            res.end();
                            return;
                        }

                        const message = JSON.parse(line.substring(6));  // Remove 'data: ' prefix
                        if (message?.choices && message?.choices[0]?.delta?.content) {
                            const token = message.choices[0].delta.content;
                            // Stream the token to the client
                            res.write(`data: ${JSON.stringify({ token })}\n\n`);
                            res.flush();  // Flush each token to the client
                        }
                    } catch (err) {
                        console.error("Error parsing JSON:", err, "Raw line:", line);
                    }
                }
            }
        });

        response.data.on("end", () => {
            // Ensure SSE connection is properly closed
            console.log("OpenAI streaming completed.");
            res.end();
        });

        response.data.on("error", (err) => {
            console.error("Streaming error:", err);
            res.write(`event: error\ndata: ${JSON.stringify({ error: "Streaming error occurred." })}\n\n`);
            res.end();
        });

    } catch (error) {
        console.error("Error during queryDocs:", error);
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
}

module.exports = { queryDocs };
