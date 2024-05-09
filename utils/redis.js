const redis = require('redis');

/**
 * creating a Redis client - displays any error
 * function isAlive - returns true when connection is successful
 * & false when not successful.
 *
 * asynchronous function get, set and del for key
 */

class RedisClient {
	constructor() {
		this.client = redis.createClient();

		this.client.on('error', (error) => {
			console.error(`${error}`);
		});
	}

	isAlive() {
		return this.client.isReady;
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

	async set(key) {
		this.client.set(key, value, 'EX', duration);
	}

	async del(key) {
		this.client.del(key);
	}
}

const redisClient = new RedisClient();
module.exports = redisClient;
