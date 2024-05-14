const { v4: uuidv4 } = require('uuid');
const redisClient = require('../utils/redis');
const sha1 = require('sha1');
const { ObjectId } = require('mongodb');
const dbClient = require('../utils/db');

class AuthController {
    static async getConnect(req, res) {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Basic ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const encodedCredentials = authHeader.split(' ')[1];
        const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
        const [email, password] = decodedCredentials.split(':');

        if (!email || !password) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const hashedPassword = sha1(password);

        try {
            const user = await dbClient.db.collection('users').findOne({ email, password: hashedPassword });

            if (!user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const token = uuidv4();
            const key = `auth_${token}`;

            await redisClient.client.set(key, user._id.toString(), 'EX', 24 * 60 * 60);

            return res.status(200).json({ token });
        } catch (error) {
            console.error('Error authenticating user:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    static async getDisconnect(req, res) {
        const { 'x-token': token } = req.headers;

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const key = `auth_${token}`;
        const userId = await redisClient.client.get(key);

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        await redisClient.client.del(key);
        return res.status(204).send();
    }
}

module.exports = AuthController;
