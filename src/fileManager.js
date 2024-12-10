import { promises as fs } from 'fs';
import { join } from 'path';

export async function writeFileContent(baseDir, dirPath, fileName, content) {
  const fullDir = join(baseDir, dirPath);
  await fs.mkdir(fullDir, { recursive: true });
  await fs.writeFile(join(fullDir, fileName), content);
}

export async function writeBlobs(baseDir, dirPath, blobs) {
  const blobDir = join(baseDir, dirPath);

  const writePromises = Object.entries(blobs).map(([key, blob]) => {
    if (typeof blob === 'string') {
      return fs.writeFile(join(blobDir, key), Buffer.from(blob, 'base64'));
    } else if (blob && typeof blob.content === 'string') {
      return fs.writeFile(join(blobDir, key), Buffer.from(blob.content, 'base64'));
    } else {
      throw new Error(`Invalid blob format for key ${key}`);
    }
  });

  await Promise.all(writePromises);
}
