const Queue = require('bull');
const thumbnail = require('image-thumbnail');
const fs = require('fs');
const path = require('path');
const { ObjectId } = require('mongodb');
const redisClient = require('./utils/redis');

const fileQueue = new Queue('fileQueue');

fileQueue.process(async (job) => {
    const { userId, fileId } = job.data;

    if (!fileId) {
        throw new Error('Missing fileId');
    }

    if (!userId) {
        throw new Error('Missing userId');
    }

    const file = await dbClient.db.collection('files').findOne({ name: fileId, userId: ObjectId(userId) });
    if (!file) {
        throw new Error('File not found');
    }

    const filePath = path.join(process.env.FOLDER_PATH || '/tmp/files_manager', fileId);
    const thumbnailsFolder = path.join(process.env.FOLDER_PATH || '/tmp/files_manager', 'thumbnails');
    if (!fs.existsSync(thumbnailsFolder)) {
        fs.mkdirSync(thumbnailsFolder);
    }

    const sizes = [500, 250, 100];
    const promises = sizes.map(async (size) => {
        const thumbnailPath = path.join(thumbnailsFolder, `${fileId}_${size}`);
        const thumbnailData = await thumbnail(filePath, { width: size });
        fs.writeFileSync(thumbnailPath, thumbnailData);
    });

    await Promise.all(promises);
});

module.exports = fileQueue;
