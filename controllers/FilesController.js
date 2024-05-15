const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const redisClient = require('../utils/redis');
const fs = require('fs');
const path = require('path');
const fileQueue = require('../worker');

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

                if (type === 'image') {
                    fileQueue.add({ userId, fileId: fileName });
                }
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
	static async getShow(req, res) {
        const { 'x-token': token } = req.headers;
        const { id } = req.params;

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            const userId = await redisClient.client.get(`auth_${token}`);
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(id), userId: ObjectId(userId) });
            if (!file) {
                return res.status(404).json({ error: 'Not found' });
            }

            return res.json(file);
        } catch (error) {
            console.error('Error getting file:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    static async getIndex(req, res) {
        const { 'x-token': token } = req.headers;
        const { parentId = '0', page = 0 } = req.query;

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            const userId = await redisClient.client.get(`auth_${token}`);
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const skip = parseInt(page) * 20;
            const files = await dbClient.db.collection('files')
                .find({ userId: ObjectId(userId), parentId: ObjectId(parentId) })
                .skip(skip)
                .limit(20)
                .toArray();

            return res.json(files);
        } catch (error) {
            console.error('Error getting files:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
	static async putPublish(req, res) {
        const { 'x-token': token } = req.headers;
        const { id } = req.params;

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            const userId = await redisClient.client.get(`auth_${token}`);
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(id), userId: ObjectId(userId) });
            if (!file) {
                return res.status(404).json({ error: 'Not found' });
            }

            await dbClient.db.collection('files').updateOne({ _id: ObjectId(id) }, { $set: { isPublic: true } });
            const updatedFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(id) });

            return res.json(updatedFile);
        } catch (error) {
            console.error('Error publishing file:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    static async putUnpublish(req, res) {
        const { 'x-token': token } = req.headers;
        const { id } = req.params;

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            const userId = await redisClient.client.get(`auth_${token}`);
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(id), userId: ObjectId(userId) });
            if (!file) {
                return res.status(404).json({ error: 'Not found' });
            }

            await dbClient.db.collection('files').updateOne({ _id: ObjectId(id) }, { $set: { isPublic: false } });
            const updatedFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(id) });

            return res.json(updatedFile);
        } catch (error) {
            console.error('Error unpublishing file:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
	static async getFile(req, res) {
        const { 'x-token': token } = req.headers;
        const { id } = req.params;
        const { size } = req.query;

        try {
            const userId = await redisClient.client.get(`auth_${token}`);
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(id) });
            if (!file) {
                return res.status(404).json({ error: 'Not found' });
            }

            if (!file.isPublic && file.userId.toString() !== userId) {
                return res.status(404).json({ error: 'Not found' });
            }

            if (file.type === 'folder') {
                return res.status(400).json({ error: 'A folder doesn\'t have content' });
            }

            let filePath = path.join(process.env.FOLDER_PATH || '/tmp/files_manager', file.localPath);

            // If size query parameter is provided, append the size to the file name
            if (size) {
                filePath += `_${size}`;
            }

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Not found' });
            }

            const fileData = fs.readFileSync(filePath);
            const mimeType = mime.lookup(filePath);

            res.setHeader('Content-Type', mimeType);
            return res.send(fileData);
        } catch (error) {
            console.error('Error getting file data:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}

module.exports = FilesController;
