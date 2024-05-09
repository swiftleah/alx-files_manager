const redis = require('redis');

class RedisClient {
    constructor() {
        this.client = redis.createClient();

        this.client.on('error', (error) => {
            console.error('Error connecting to Redis:', error);
        });
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
