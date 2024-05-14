const { ObjectId } = require('mongodb');
const sha1 = require('sha1');
const dbClient = require('../utils/db');

class UsersController {
    static async postNew(req, res) {
        const { email, password } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Missing email' });
        }
        if (!password) {
            return res.status(400).json({ error: 'Missing password' });
        }

        const userExists = await dbClient.db.collection('users').findOne({ email });
        if (userExists) {
            return res.status(400).json({ error: 'Already exist' });
        }

        const hashedPassword = sha1(password);

        try {
            const result = await dbClient.db.collection('users').insertOne({ email, password: hashedPassword });

            const newUser = {
                id: result.insertedId,
                email
            };
            return res.status(201).json(newUser);
        } catch (error) {
            console.error('Error creating user:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    static async getMe(req, res) {
	const { user } = req;
	res.status(200).json({ email: user.email, id: user._id.toString() });
    }
}

module.exports = UsersController;
