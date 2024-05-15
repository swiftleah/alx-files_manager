/**
 * DBClient handles operations with MongoDB db
 * provides methods to check connection status and get num
 * of documents in collections 'users' and 'files'
 */
import { MongoClient } from 'mongodb';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 27017;
const DB_DATABASE = process.env.DB_DATABASE || 'files_manager';
const url = `mongodb://${DB_HOST}:${DB_PORT}`;

class DBClient {
  constructor() {
    this.db = null;
    this.connect();
  }

  async connect() {
    try {
      const client = await MongoClient.connect(url, { useUnifiedTopology: true });
      this.db = client.db(DB_DATABASE);
      this.usersCollection = this.db.collection('users');
      this.filesCollection = this.db.collection('files');
      console.log('Connected successfully to server');
    } catch (err) {
      console.error('Error connecting to MongoDB:', err.message);
      this.db = null;
    }
  }

  isAlive() {
    return this.db !== null;
  }

  async nbUsers() {
    if (!this.usersCollection) throw new Error('Collection not initialized');
    return await this.usersCollection.countDocuments();
  }

  async nbFiles() {
    if (!this.filesCollection) throw new Error('Collection not initialized');
    return await this.filesCollection.countDocuments();
  }
}

const dbClient = new DBClient();

export default dbClient;
