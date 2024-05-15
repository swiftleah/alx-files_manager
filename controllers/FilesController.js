const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const redisClient = require('../utils/redis');
const fs = require('fs');
const path = require('path');

class FilesController {
    static async postUpload(req, res) {
        const { 'x-token': token } = req.headers;
        const { name, type, data, parentId = '0', isPublic = false } = req.body;

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!name) {
            return res.status(400).json({ error: 'Missing name' });
        }

        if (!type || !['folder', 'file', 'image'].includes(type)) {
            return res.status(400).json({ error: 'Missing or invalid type' });
        }

        if ((type !== 'folder') && !data) {
            return res.status(400).json({ error: 'Missing data' });
        }

        const key = `auth_${token}`;
        const userId = await redisClient.client.get(key);

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
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

            let localPath;
            if (type !== 'folder') {
                const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
                if (!fs.existsSync(folderPath)) {
                    fs.mkdirSync(folderPath, { recursive: true });
                }
                const fileName = uuidv4();
                localPath = path.join(folderPath, fileName);
                const fileData = Buffer.from(data, 'base64');
                fs.writeFileSync(localPath, fileData);
            }

            const fileDoc = {
                userId: ObjectId(userId),
                name,
                type,
                isPublic,
                parentId: ObjectId(parentId),
                localPath: localPath || null
            };
            const result = await dbClient.db.collection('files').insertOne(fileDoc);
            const newFile = {
                id: result.insertedId,
                userId,
                name,
                type,
                isPublic,
                parentId
            };

            return res.status(201).json(newFile);
        } catch (error) {
            console.error('Error uploading file:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}

module.exports = FilesController;
