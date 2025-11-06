
require('dotenv').config();
const { MongoClient } = require('mongodb');

const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
    console.error('MONGO_URI not found in .env file');
    process.exit(1);
}

console.log(`Connecting to MongoDB at ${mongoUri}...`);

const client = new MongoClient(mongoUri);

client.connect().then(() => {
    console.log('MongoDB connection successful!');
    client.close();
    process.exit(0);
}).catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});
