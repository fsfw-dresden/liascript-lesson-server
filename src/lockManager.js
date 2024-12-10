// Simple in-memory lock management
const locks = new Map();

export function clearAllLocks() {
  locks.clear();
}

export function acquireLock(documentId) {
  if (locks.has(documentId)) {
    return false;
  }
  locks.set(documentId, Date.now());
  return true;
}

export function releaseLock(documentId) {
  locks.delete(documentId);
}
