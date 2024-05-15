import Queue from 'bull';
import fs from 'fs';
import imageThumbnail from 'image-thumbnail';
import { ObjectID } from 'mongodb';
import dbClient from './utils/db';

const fileQueue = new Queue('fileQueue');
const userQueue = new Queue('userQueue');

async function createThumbnail(width, localPath) {
  return imageThumbnail(localPath, { width });
}

fileQueue.process(async (job, done) => {
  console.log('Processing Started!');
  const { fileId, userId } = job.data;
  if (!fileId) return done(new Error('Missing fileId'));
  if (!userId) return done(new Error('Missing userId'));

  console.log(fileId, userId);
  try {
    const file = await dbClient.findOne('files', { _id: new ObjectID(fileId) });
    if (!file) throw new Error('File not found');

    const fileName = file.localPath;
    const tNail500 = await createThumbnail(500, fileName);
    const tNail250 = await createThumbnail(250, fileName);
    const tNail100 = await createThumbnail(100, fileName);

    console.log('Writing thumbnail files to the system');
    const image500 = `${file.localPath}_500`;
    const image250 = `${file.localPath}_250`;
    const image100 = `${file.localPath}_100`;

    await Promise.all([
      fs.promises.writeFile(image500, tNail500),
      fs.promises.writeFile(image250, tNail250),
      fs.promises.writeFile(image100, tNail100)
    ]);
    done();
  } catch (err) {
    console.error(err.message);
    done(err);
  }
});

userQueue.process(async (job, done) => {
  const { userId } = job.data;
  if (!userId) return done(new Error('Missing userId'));

  try {
    const user = await dbClient.findOne('users', { _id: new ObjectID(userId) });
    if (!user) throw new Error('User not found');

    console.log(`Welcome ${user.email}`);
    done();
  } catch (err) {
    console.error(err.message);
    done(err);
  }
});

userQueue.on('failed', (job, err) => {
  console.error(`Error: ${err.message}`);
});
