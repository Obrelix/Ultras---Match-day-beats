// ============================================
// customChants.js — Custom chant upload and IndexedDB storage
// ============================================

const DB_NAME = 'ultras_custom_chants';
const DB_VERSION = 1;
const STORE_NAME = 'chants';

let db = null;

// ============================================
// IndexedDB Setup
// ============================================

/**
 * Initialize IndexedDB for custom chant storage
 */
export async function initCustomChantDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('Failed to open IndexedDB:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            // Create object store for chants
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('clubId', 'clubId', { unique: false });
                store.createIndex('uploadDate', 'uploadDate', { unique: false });
            }
        };
    });
}

/**
 * Ensure database is initialized
 */
async function ensureDB() {
    if (!db) {
        await initCustomChantDB();
    }
    return db;
}

// ============================================
// Chant CRUD Operations
// ============================================

/**
 * Save a custom chant to IndexedDB
 * @param {Object} chant - Chant data with audioData as ArrayBuffer
 */
export async function saveCustomChant(chant) {
    const database = await ensureDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const chantData = {
            id: chant.id || `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: chant.name,
            clubId: chant.clubId || 'custom',
            audioData: chant.audioData, // ArrayBuffer
            duration: chant.duration,
            uploadDate: Date.now(),
            copyrightAcknowledged: chant.copyrightAcknowledged || false,
            fileSize: chant.audioData.byteLength,
            fileName: chant.fileName
        };

        const request = store.put(chantData);

        request.onsuccess = () => resolve(chantData);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get a custom chant by ID
 */
export async function getCustomChant(id) {
    const database = await ensureDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get all custom chants (metadata only, not audio data)
 */
export async function getAllCustomChants() {
    const database = await ensureDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            // Return metadata without the heavy audioData
            const chants = request.result.map(chant => ({
                id: chant.id,
                name: chant.name,
                clubId: chant.clubId,
                duration: chant.duration,
                uploadDate: chant.uploadDate,
                fileSize: chant.fileSize,
                fileName: chant.fileName
            }));
            resolve(chants);
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get custom chants for a specific club
 */
export async function getCustomChantsForClub(clubId) {
    const database = await ensureDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('clubId');
        const request = index.getAll(clubId);

        request.onsuccess = () => {
            const chants = request.result.map(chant => ({
                id: chant.id,
                name: chant.name,
                clubId: chant.clubId,
                duration: chant.duration,
                uploadDate: chant.uploadDate,
                fileSize: chant.fileSize
            }));
            resolve(chants);
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Delete a custom chant
 */
export async function deleteCustomChant(id) {
    const database = await ensureDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get the audio ArrayBuffer for a custom chant
 */
export async function getCustomChantAudio(id) {
    const chant = await getCustomChant(id);
    return chant ? chant.audioData : null;
}

// ============================================
// File Upload Handling
// ============================================

/**
 * Process an uploaded MP3 file
 * @param {File} file - The uploaded file
 * @param {AudioContext} audioContext - For decoding and duration
 * @returns {Object} Processed chant data
 */
export async function processUploadedFile(file, audioContext) {
    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg)$/i)) {
        throw new Error('Invalid file type. Please upload an MP3, WAV, or OGG file.');
    }

    // Validate file size (max 20MB)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
        throw new Error('File too large. Maximum size is 20MB.');
    }

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Decode to get duration
    let duration = 0;
    try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        duration = audioBuffer.duration;
    } catch (e) {
        throw new Error('Could not decode audio file. Please ensure it is a valid audio file.');
    }

    // Validate duration (max 10 minutes)
    if (duration > 600) {
        throw new Error('Audio too long. Maximum duration is 10 minutes.');
    }

    // Extract name from filename
    const name = file.name.replace(/\.(mp3|wav|ogg)$/i, '').replace(/[_-]/g, ' ');

    return {
        name,
        audioData: arrayBuffer,
        duration,
        fileName: file.name,
        fileSize: file.size
    };
}

/**
 * Create an audio URL from stored ArrayBuffer
 * Remember to revoke the URL when done!
 */
export function createAudioURL(arrayBuffer) {
    const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
    return URL.createObjectURL(blob);
}

/**
 * Decode stored audio to AudioBuffer
 */
export async function decodeCustomChantAudio(id, audioContext) {
    const audioData = await getCustomChantAudio(id);
    if (!audioData) {
        throw new Error('Custom chant not found');
    }

    // Need to slice to create a new ArrayBuffer (decodeAudioData detaches the buffer)
    return audioContext.decodeAudioData(audioData.slice(0));
}

// ============================================
// Storage Info
// ============================================

/**
 * Get total storage used by custom chants
 */
export async function getStorageUsage() {
    const chants = await getAllCustomChants();
    const totalBytes = chants.reduce((sum, chant) => sum + (chant.fileSize || 0), 0);

    return {
        count: chants.length,
        totalBytes,
        totalMB: (totalBytes / (1024 * 1024)).toFixed(2)
    };
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable() {
    return 'indexedDB' in window;
}

// ============================================
// Community Chants (Curated - Placeholder)
// ============================================

// These would be fetched from a server in a real implementation
const COMMUNITY_CHANTS = [
    // Placeholder - these would be curated, copyright-cleared chants
    // {
    //     id: 'community_1',
    //     name: 'Generic Stadium Chant',
    //     artist: 'Public Domain',
    //     url: '/chants/community/generic_chant.mp3',
    //     duration: 45,
    //     isCommunity: true
    // }
];

/**
 * Get community (curated) chants
 * In a real implementation, this would fetch from a server
 */
export function getCommunityChants() {
    return COMMUNITY_CHANTS;
}

/**
 * Check if a chant is a community chant
 */
export function isCommunityChant(chantId) {
    return chantId.startsWith('community_');
}
