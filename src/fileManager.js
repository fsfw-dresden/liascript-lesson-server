import { promises as fs } from 'fs';
import { join } from 'path';

export async function writeFileContent(baseDir, documentId, fileName, content) {
  const docDir = join(baseDir, documentId);
  await fs.mkdir(docDir, { recursive: true });
  await fs.writeFile(join(docDir, fileName), content);
}

export async function writeBlobs(baseDir, documentId, blobs) {
  const blobDir = join(baseDir, documentId, 'blobs');
  await fs.mkdir(blobDir, { recursive: true });

  const writePromises = Object.entries(blobs).map(([key, content]) =>
    fs.writeFile(join(blobDir, key), content)
  );

  await Promise.all(writePromises);
}
