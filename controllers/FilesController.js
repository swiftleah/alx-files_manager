import fs from 'fs';
import { ObjectId } from 'mongodb';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import Queue from 'bull';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const fileQueue = new Queue('fileQueue');

async function getUser(req) {
  const token = req.headers['x-token'];
  if (!token) return null;

  try {
    const userId = await redisClient.get(`auth_${token}`);
    return await dbClient.findOne('users', { _id: new ObjectId(userId) });
  } catch (err) {
    return null;
  }
}

export async function postUpload(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { name, type, data, parentId, isPublic } = req.body;
  if (!name || !type || !['folder', 'file', 'image'].includes(type) || (!data && type !== 'folder')) {
    return res.status(400).json({ error: 'Invalid request data' });
  }

  let parentIdObj;
  try {
    parentIdObj = parentId && parentId !== '0' ? new ObjectId(parentId) : '0';
  } catch (err) {
    return res.status(400).json({ error: 'Invalid parent ID' });
  }

  if (parentIdObj !== '0') {
    const parentFolder = await dbClient.findOne('files', { _id: parentIdObj });
    if (!parentFolder || parentFolder.type !== 'folder') {
      return res.status(400).json({ error: 'Invalid parent folder' });
    }
  }

  const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
  await promisify(fs.mkdir)(folderPath, { recursive: true });

  const localPath = `${folderPath}/${uuidv4()}`;
  await promisify(fs.writeFile)(localPath, Buffer.from(data, 'base64').toString('utf-8'));

  const fileData = {
    userId: user._id,
    name,
    type,
    isPublic,
    parentId: parentIdObj,
    localPath,
  };

  const { insertedId } = await dbClient.insertOne('files', fileData);
  fileData._id = insertedId;

  if (type === 'image') {
    fileQueue.add({ userId: user._id, fileId: fileData._id });
  }

  return res.status(201).json({
    id: fileData._id.toString(),
    userId: user._id.toString(),
    name,
    type,
    isPublic,
    parentId: parentIdObj !== '0' ? parentIdObj.toString() : 0,
  });
}

export async function getShow(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const fileId = req.params.id;

  let file;
  try {
    file = await dbClient.findOne('files', { _id: new ObjectId(fileId), userId: user._id });
    if (!file) throw new Error('File not found');
  } catch (err) {
    return res.status(404).json({ error: 'File not found' });
  }

  return res.status(200).json({
    id: file._id.toString(),
    userId: user._id.toString(),
    name: file.name,
    type: file.type,
    isPublic: file.isPublic,
    parentId: file.parentId === '0' ? 0 : file.parentId.toString(),
  });
}

export async function getIndex(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  let parentIdObj;
  try {
    parentIdObj = req.query.parentId && req.query.parentId !== '0' ? new ObjectId(req.query.parentId) : '0';
  } catch (err) {
    return res.json([]);
  }

  const matchQuery = { userId: user._id };
  if (parentIdObj !== '0') matchQuery.parentId = parentIdObj;

  const page = Number(req.query.page) || 0;

  const filesCollection = dbClient.db.collection('files');
  const files = await filesCollection.aggregate([
    { $match: matchQuery },
    { $skip: page * 20 },
    { $limit: 20 },
    {
      $project: {
        _id: 0,
        id: '$_id',
        userId: '$userId',
        name: '$name',
        type: '$type',
        isPublic: '$isPublic',
        parentId: {
          $cond: { if: { $eq: ['$parentId', '0'] }, then: 0, else: '$parentId' },
        },
      },
    },
  ]).toArray();

  return res.status(200).json(files);
}

async function updateFilePublicStatus(req, res, isPublic) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const fileId = req.params.id;

  let file;
  try {
    file = await dbClient.findOne('files', { _id: new ObjectId(fileId), userId: user._id });
    if (!file) throw new Error('File not found');
  } catch (err) {
    return res.status(404).json({ error: 'File not found' });
  }

  await dbClient.db.collection('files').updateOne({ _id: new ObjectId(fileId), userId: user._id }, { $set: { isPublic } });

  const updatedFile = await dbClient.findOne('files', { _id: new ObjectId(fileId), userId: user._id });

  return res.status(200).json({
    id: fileId,
    userId: user._id.toString(),
    name: updatedFile.name,
    type: updatedFile.type,
    isPublic: updatedFile.isPublic,
    parentId: updatedFile.parentId === '0' ? 0 : updatedFile.parentId.toString(),
  });
}

export async function publish(req, res) {
  return updateFilePublicStatus(req, res, true);
}

export async function unpublish(req, res) {
  return updateFilePublicStatus(req, res, false);
}

export async function getFile(req, res) {
  const fileId = req.params.id;

  let file;
  try {
    file = await dbClient.findOne('files', { _id: new ObjectId(fileId) });
    if (!file || (!file.isPublic && !(await getUser(req)))) throw new Error('File not found');
  } catch (err) {
    return res.status(404).json({ error: 'File not found' });
  }

  if (file.type === 'folder') return res.status(400).json({ error: "A folder doesn't have content" });

  const readFile = promisify(fs.readFile);
  try {
    let filePath = file.localPath;
    const { size } = req.query;
    if (size) filePath = `${file.localPath}_${size}`;
    const data = await readFile(filePath);

    return res.set('Content-Type', mime.lookup(file.name)).send(data);
  } catch (err) {
    return res.status(404).json({ error: 'Not found' });
  }
}

