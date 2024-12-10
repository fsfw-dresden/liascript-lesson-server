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
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp, ...metadata }) => {
      let msg = `${timestamp} ${level}: ${message}`;
      if (Object.keys(metadata).length > 0) {
        msg += '\n' + JSON.stringify(metadata, null, 2);
      }
      return msg;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: 'error.log', 
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    new winston.transports.File({ 
      filename: 'combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Serve files from storage directory
app.use('/static', express.static(join(__dirname, '../storage')));

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
