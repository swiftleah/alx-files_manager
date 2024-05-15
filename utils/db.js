#!/usr/bin/node

/**
 * DBClient handles operations with MongoDB db
 * provides methods to check connection status and get num
 * of documents in collections 'users' and 'files'
 */

import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    this.host = process.env.DB_HOST || 'localhost';
    this.port = process.env.DB_PORT || '27017';
    this.dbName = process.env.DB_DATABASE || 'files_manager';

    this.url = `mongodb://${this.host}:${this.port}`;
    this.client = new MongoClient(this.url, { useUnifiedTopology: true });

    this.connected = false;
    this.connect();
  }

  connect() {
    this.client.connect((err) => {
      if (err) {
        console.log(err.message);
      } else {
        this.connected = true;
        this.db = this.client.db(this.dbName);
      }
    });
  }

  isAlive() {
    return this.connected;
  }
  
  async nbUsers() {
    return this.db.collection('users').countDocuments({});
  }

  async nbFiles() {
    return this.db.collection('files').countDocuments({});
  }

  async insertOne(coll, doc) {
    return this.db.collection(coll).insertOne(doc);
  }

  async insertMany(coll, docs) {
    return this.db.collection(coll).insertMany(docs);
  }

  async findOne(coll, filter) {
    return this.db.collection(coll).findOne(filter);
  }

  async deleteMany(coll, filter) {
    return this.db.collection(coll).deleteMany(filter);
  }

  async deleteOne(coll, filter) {
    return this.db.collection(coll).deleteOne(filter);
  }
}

const dbClient = new DBClient();
export default dbClient;
