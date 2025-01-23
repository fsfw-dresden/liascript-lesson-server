import express from 'express';
import cors from 'cors';
import asyncHandler from 'express-async-handler';
import { clearAllLocks, acquireLock, releaseLock } from './lockManager.js';
import { writeFileContent, writeBlobs } from './fileManager.js';
import { logger } from './logger.js';

const PROTOCOL = process.env.PROTOCOL || "http";
const HOST = process.env.HOST || "localhost";
const PORT = process.env.PORT || 9000;

const BASE_URL = `${PROTOCOL}://${HOST}:${PORT}`;

const app = express();
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

const STORAGE_DIR = process.env.STORAGE_DIR || './storage';
const LIASCRIPT_EDITOR_DIST = process.env.LIASCRIPT_EDITOR_DIST || './liascript-editor';

// Serve files from storage directory
app.use('/static', express.static(STORAGE_DIR));


logger.info(`Using storage directory: ${STORAGE_DIR}`);

// Clear all locks on server start
clearAllLocks();


app.post('/sync', asyncHandler(async (req, res) => {
  const { documentId, fileContent, blobs } = req.body;

  const relativePath = documentId;
  const fileName = relativePath.split('/').pop();
  const dirPath = relativePath.substring(0, relativePath.length - fileName.length - 1);

  logger.info(`Received sync request for document at path ${relativePath}`, {
    dirPath,
    fileName,
    blobCount: Object.keys(blobs || {}).length
  });

  try {
    // Try to acquire lock using relativePath
    if (!acquireLock(relativePath)) {
      logger.warn(`Document ${relativePath} is locked, rejecting request`);
      return res.status(423).json({ 
        error: 'Document is locked, please try again later' 
      });
    }

   let modifiedFileContent = fileContent;


    // Write blobs
    if (blobs) {
      await writeBlobs(STORAGE_DIR, dirPath, blobs);
      logger.info(`Written ${Object.keys(blobs).length} blobs for ${relativePath}`);
      /*for (const blob of Object.keys(blobs)) {
        modifiedFileContent = modifiedFileContent.replace(`(${blob})`, `(${BASE_URL}/static/${dirPath}/${blob})`); 
      }*/
    }
    // Write main file content
    await writeFileContent(STORAGE_DIR, dirPath, fileName, modifiedFileContent);
    logger.info(`Written main file at ${relativePath}`);

    res.json({ success: true, fileContent: modifiedFileContent });
  } catch (error) {
    logger.error('Error processing sync request', {
      documentId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  } finally {
    releaseLock(relativePath);
    logger.info(`Released lock for document ${relativePath}`);
  }
}));

app.use(/^(?!\/sync|\/static).*/, (req, res, next) => {
  // Remove any duplicate paths and trailing slashes
  const requestPath = req.originalUrl
    .replace(/\/+/g, '/') // Replace multiple consecutive slashes with a single one
    .replace(/\/$/, '');  // Remove trailing slash
    
  // Create a new request object with the corrected path
  req.url = requestPath;
  
  express.static(LIASCRIPT_EDITOR_DIST, {
    index: 'index.html',
    fallthrough: true,
    setHeaders: (res, path, stat) => {
      const mimeType = express.static.mime.lookup(path);
      logger.info(`Serving ${path} with MIME type: ${mimeType}`);
      res.set('Content-Type', mimeType);
    }
  })(req, res, next);
});

app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
});
