const pinecone = require("pinecone-node");
const { config } = require('dotenv');

// Load environment variables
config();

// Initialize Pinecone client
const pineconeClient = new pinecone.PineconeClient();

const initializePinecone = async () => {
  await pineconeClient.init({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
  });
};

module.exports = { pineconeClient, initializePinecone };