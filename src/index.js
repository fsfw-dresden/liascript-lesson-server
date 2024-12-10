import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import winston from 'winston';
import asyncHandler from 'express-async-handler';
import { clearAllLocks, acquireLock, releaseLock } from './lockManager.js';
import { writeFileContent, writeBlobs } from './fileManager.js';

// Setup logger
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STORAGE_DIR = join(__dirname, '../storage');

// Clear all locks on server start
clearAllLocks();

app.post('/sync', asyncHandler(async (req, res) => {
  const { documentId, fileName, fileContent, blobs } = req.body;

  logger.info(`Received sync request for document ${documentId}`, {
    fileName,
    blobCount: Object.keys(blobs || {}).length
  });

  try {
    // Try to acquire lock
    if (!acquireLock(documentId)) {
      logger.warn(`Document ${documentId} is locked, rejecting request`);
      return res.status(423).json({ 
        error: 'Document is locked, please try again later' 
      });
    }

    // Write main file content
    await writeFileContent(STORAGE_DIR, documentId, fileName, fileContent);
    logger.info(`Written main file for document ${documentId}`);

    // Write blobs
    if (blobs) {
      await writeBlobs(STORAGE_DIR, documentId, blobs);
      logger.info(`Written ${Object.keys(blobs).length} blobs for document ${documentId}`);
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error processing sync request', {
      documentId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  } finally {
    releaseLock(documentId);
    logger.info(`Released lock for document ${documentId}`);
  }
}));

const PORT = process.env.PORT || 9000;
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
});
