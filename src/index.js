import express from 'express';
import cors from 'cors';
import { join } from 'path';
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

const PROTOCOL = process.env.PROTOCOL || "http";
const HOST = process.env.HOST || "localhost";
const PORT = process.env.PORT || 9000;

const BASE_URL = `${PROTOCOL}://${HOST}:${PORT}`;

const app = express();
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

const STORAGE_DIR = process.env.STORAGE_DIR || './storage';

// Serve files from storage directory
app.use('/static', express.static(STORAGE_DIR));

logger.info(`Using storage directory: ${STORAGE_DIR}`);

// Clear all locks on server start
clearAllLocks();

app.post('/sync', asyncHandler(async (req, res) => {
  const { documentId, fileContent, blobs } = req.body;

  // Extract path from documentId which should be in format "/static/path/to/file.md"
  const pathMatch = documentId.match(/.*\/static\/(.+)$/);
  if (!pathMatch) {
    return res.status(400).json({
      error: 'Invalid document ID format. Must start with .*/static/'
    });
  }

  const relativePath = pathMatch[1];
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
      for (const blob of Object.keys(blobs)) {
        modifiedFileContent = modifiedFileContent.replace(`(${blob})`, `(${BASE_URL}/static/${dirPath}/${blob})`); 
      }
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

app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
});
