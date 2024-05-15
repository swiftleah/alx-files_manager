#!/usr/bin/node

const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
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

        try {
            if (parentId !== '0') {
                const parentFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId) });
                if (!parentFile) {
                    return res.status(400).json({ error: 'Parent not found' });
                }
                if (parentFile.type !== 'folder') {
                    return res.status(400).json({ error: 'Parent is not a folder' });
                }
            }

            let localPath = '';
            if (type === 'file' || type === 'image') {
                const filePath = process.env.FOLDER_PATH || '/tmp/files_manager';
                localPath = `${filePath}/${uuidv4()}`;
                const fileBuffer = Buffer.from(data, 'base64');
                fs.writeFileSync(localPath, fileBuffer);
            }

            const newFile = {
                userId: ObjectId(userId),
                name,
                type,
                isPublic,
                parentId: ObjectId(parentId),
                localPath: type === 'file' || type === 'image' ? localPath : undefined
            };

            const result = await dbClient.db.collection('files').insertOne(newFile);

            return res.status(201).json({
                id: result.insertedId,
                userId,
                name,
                type,
                isPublic,
                parentId
            });
        } catch (error) {
            console.error('Error uploading file:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}

module.exports = FilesController;
