#!/usr/bin/node

const { ObjectId } = require('mongodb');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class FilesController {
    static async postUpload(req, res) {
        const { 'x-token': token } = req.headers;

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const key = `auth_${token}`;
        const userId = await redisClient.client.get(key);

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { name, type, data, parentId = '0', isPublic = false } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Missing name' });
        }

        if (!type || !['folder', 'file', 'image'].includes(type)) {
            return res.status(400).json({ error: 'Missing or invalid type' });
        }

        if ((type === 'file' || type === 'image') && !data) {
            return res.status(400).json({ error: 'Missing data' });
        }

        if (parentId !== '0') {
            const parentFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId) });

            if (!parentFile) {
                return res.status(400).json({ error: 'Parent not found' });
            }

            if (parentFile.type !== 'folder') {
                return res.status(400).json({ error: 'Parent is not a folder' });
            }
        }

        try {

            return res.status(201).json(newFile);
        } catch (error) {
            console.error('Error uploading file:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

	static async getShow(req, res) {
        const { 'x-token': token } = req.headers;

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const key = `auth_${token}`;
        const userId = await redisClient.client.get(key);

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;

        try {
            const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(id), userId: ObjectId(userId) });

            if (!file) {
                return res.status(404).json({ error: 'Not found' });
            }

            return res.json(file);
        } catch (error) {
            console.error('Error retrieving file:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    static async getIndex(req, res) {
        const { 'x-token': token } = req.headers;

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const key = `auth_${token}`;
        const userId = await redisClient.client.get(key);

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        let { parentId = '0', page = 0 } = req.query;
        page = parseInt(page);

        try {
            const files = await dbClient.db.collection('files')
                .find({ userId: ObjectId(userId), parentId: ObjectId(parentId) })
                .skip(page * 20)
                .limit(20)
                .toArray();

            return res.json(files);
        } catch (error) {
            console.error('Error retrieving files:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}

module.exports = FilesController;
