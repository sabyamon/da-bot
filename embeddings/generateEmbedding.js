const fs = require('fs');
const path = require('path');
const { config } = require('dotenv');
const { OpenAIEmbeddings } = require('@langchain/openai');
const { Pinecone } = require('@pinecone-database/pinecone');

// Load environment variables
config();

// Initialize OpenAI Embeddings
const openaiApiKey = process.env.OPENAI_API_KEY;
const embeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small", openaiApiKey });

// Initialize Pinecone
const pineconeClient = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
    // environment: process.env.PINECONE_ENVIRONMENT,
});

async function generateEmbeddings() {
    const indexName = process.env.INDEX_NAME;
    const indexes = await pineconeClient.listIndexes();

    console.log(indexes.indexes);
    const indexNames = indexes.indexes.map(index => index.name);    
    console.log(indexNames);
    console.log(indexNames.includes(indexName));

    if (!indexNames.includes(indexName)) {
        await pineconeClient.createIndex({
            name: indexName,
            dimension: 1536,
            metric: "cosine",
            metadataConfig: {
                indexed: ["url", "title", "content", "images", "youtube_links"]
            },
            spec: {
                type: "serverless",
                cloud: "aws",
                region: "us-east-1"
            }
        });
    }

    const index = pineconeClient.Index(indexName);

    // Load data and generate embeddings
    // const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'da_live_docs.json');
    const dataPath = path.join(__dirname, '..', 'data', 'da_live_docs.json');
    const docs = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    for (const doc of docs) {
        const content = doc.content;
        const metadata = {
            url: doc.url,
            title: doc.title,
            content: content,
            images: doc.images || [],
            youtube_links: doc.youtube_links || []
        };

        // Generate embeddings
        const vector = await embeddings.embedQuery(content);

        // Upsert into Pinecone
        await index.upsert([{
            id: doc.url,
            values: vector,
            metadata: metadata
        }]);
    }

    console.log(`Uploaded ${docs.length} documents to Pinecone.`);
};

module.exports = { generateEmbeddings };
