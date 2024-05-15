#!/usr/bin/node

/**
 * RedisClient class
 * constructor creates client to redis and handles errors
 * isAlive returns boolean for connection to Redis
 * async function get, set and del
 */
const redis = require('redis');
const { promisify } = require('util');

class RedisClient {
    constructor() {
        this.client = redis.createClient();

        this.client.on('error', (error) => {
            console.error('Error connecting to Redis:', error);
        });

	this.getAsync = promisify(this.client.get).bind(this.client);
	this.setAsync = promisify(this.client.set).bind(this.client);
	this.delAsync = promisify(this.client.del).bind(this.client);
    }

    isAlive() {
        return this.client.connected;
    }

    async get(key) {
        return new Promise((resolve, reject) => {
            this.client.get(key, (error, value) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(value);
                }
            });
        });
    }

    async set(key, value, duration) {
        this.client.set(key, value, 'EX', duration);
    }

    async del(key) {
        this.client.del(key);
    }
}

const redisClient = new RedisClient();
module.exports = redisClient;
