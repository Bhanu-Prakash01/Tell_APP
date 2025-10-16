const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * File Management Utilities for the Telecalling Web Application
 * Provides comprehensive file handling, validation, and cleanup functions
 */

/**
 * Get file extension from filename
 * @param {string} filename - Original filename
 * @returns {string} File extension in lowercase
 */
const getFileExtension = (filename) => {
  return path.extname(filename).toLowerCase().replace('.', '');
};

/**
 * Get MIME type from file extension
 * @param {string} extension - File extension
 * @returns {string|null} MIME type or null if not found
 */
const getMimeTypeFromExtension = (extension) => {
  const mimeTypes = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'csv': 'text/csv',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif'
  };
  return mimeTypes[extension] || null;
};

/**
 * Validate file type against allowed types
 * @param {string} filename - Original filename
 * @param {string} mimetype - File MIME type
 * @param {Array} allowedTypes - Array of allowed MIME types
 * @returns {boolean} True if file type is valid
 */
const validateFileType = (filename, mimetype, allowedTypes) => {
  // Check MIME type first
  if (allowedTypes.includes(mimetype)) {
    return true;
  }

  // Fallback to extension check
  const extension = getFileExtension(filename);
  const expectedMimeType = getMimeTypeFromExtension(extension);
  return expectedMimeType && allowedTypes.includes(expectedMimeType);
};

/**
 * Validate file size
 * @param {number} fileSize - File size in bytes
 * @param {number} maxSize - Maximum allowed size in bytes
 * @returns {boolean} True if file size is valid
 */
const validateFileSize = (fileSize, maxSize) => {
  return fileSize > 0 && fileSize <= maxSize;
};

/**
 * Generate file hash for duplicate detection
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} SHA-256 hash of the file
 */
const generateFileHash = async (filePath) => {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  } catch (error) {
    throw new Error(`Failed to generate file hash: ${error.message}`);
  }
};

/**
 * Check if file already exists (by hash)
 * @param {string} filePath - Path to the new file
 * @param {string} directory - Directory to search for duplicates
 * @returns {Promise<boolean>} True if duplicate exists
 */
const checkFileExists = async (filePath, directory) => {
  try {
    const fileHash = await generateFileHash(filePath);
    const files = await fs.readdir(directory);

    for (const file of files) {
      const existingFilePath = path.join(directory, file);
      try {
        const existingFileHash = await generateFileHash(existingFilePath);
        if (existingFileHash === fileHash) {
          return true;
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    return false;
  } catch (error) {
    throw new Error(`Failed to check file existence: ${error.message}`);
  }
};

/**
 * Safely delete a file
 * @param {string} filePath - Path to the file to delete
 * @returns {Promise<boolean>} True if file was deleted successfully
 */
const deleteFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, consider it as successfully "deleted"
      return true;
    }
    throw new Error(`Failed to delete file ${filePath}: ${error.message}`);
  }
};

/**
 * Delete multiple files
 * @param {Array} filePaths - Array of file paths to delete
 * @returns {Promise<Array>} Array of deletion results
 */
const deleteFiles = async (filePaths) => {
  const results = [];

  for (const filePath of filePaths) {
    try {
      const deleted = await deleteFile(filePath);
      results.push({ filePath, success: true, deleted });
    } catch (error) {
      results.push({ filePath, success: false, error: error.message });
    }
  }

  return results;
};

/**
 * Clean up uploaded files (useful for error scenarios)
 * @param {Array|Object} files - Files to clean up (multer file objects)
 * @returns {Promise<void>}
 */
const cleanupUploadedFiles = async (files) => {
  if (!files) return;

  const fileList = [];

  // Handle both single files and arrays of files
  if (Array.isArray(files)) {
    fileList.push(...files);
  } else if (files.path) {
    fileList.push(files);
  } else if (typeof files === 'object') {
    // Handle multer's field-based file structure
    for (const field in files) {
      if (Array.isArray(files[field])) {
        fileList.push(...files[field]);
      } else {
        fileList.push(files[field]);
      }
    }
  }

  // Delete all files
  for (const file of fileList) {
    if (file && file.path) {
      try {
        await deleteFile(file.path);
      } catch (error) {
        console.error(`Failed to cleanup file ${file.path}:`, error);
      }
    }
  }
};

/**
 * Ensure directory exists, create if it doesn't
 * @param {string} dirPath - Directory path
 * @returns {Promise<void>}
 */
const ensureDirectory = async (dirPath) => {
  try {
    await fs.access(dirPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(dirPath, { recursive: true });
    } else {
      throw error;
    }
  }
};

/**
 * Get file statistics
 * @param {string} filePath - Path to the file
 * @returns {Promise<Object>} File statistics
 */
const getFileStats = async (filePath) => {
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory()
    };
  } catch (error) {
    throw new Error(`Failed to get file stats for ${filePath}: ${error.message}`);
  }
};

/**
 * List files in directory with filtering
 * @param {string} dirPath - Directory path
 * @param {Object} options - Options for filtering
 * @returns {Promise<Array>} Array of file information
 */
const listFiles = async (dirPath, options = {}) => {
  try {
    const {
      extensions = [],
      minSize = 0,
      maxSize = Infinity,
      recursive = false
    } = options;

    const files = await fs.readdir(dirPath);
    const results = [];

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);

      if (stats.isFile()) {
        const extension = getFileExtension(file);

        // Filter by extension
        if (extensions.length > 0 && !extensions.includes(extension)) {
          continue;
        }

        // Filter by size
        if (stats.size < minSize || stats.size > maxSize) {
          continue;
        }

        results.push({
          name: file,
          path: filePath,
          extension,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        });
      } else if (recursive && stats.isDirectory()) {
        const subFiles = await listFiles(filePath, options);
        results.push(...subFiles);
      }
    }

    return results;
  } catch (error) {
    throw new Error(`Failed to list files in ${dirPath}: ${error.message}`);
  }
};

/**
 * Move file to different location
 * @param {string} sourcePath - Source file path
 * @param {string} destinationPath - Destination file path
 * @returns {Promise<boolean>} True if file was moved successfully
 */
const moveFile = async (sourcePath, destinationPath) => {
  try {
    // Ensure destination directory exists
    const destinationDir = path.dirname(destinationPath);
    await ensureDirectory(destinationDir);

    await fs.rename(sourcePath, destinationPath);
    return true;
  } catch (error) {
    throw new Error(`Failed to move file from ${sourcePath} to ${destinationPath}: ${error.message}`);
  }
};

/**
 * Copy file to different location
 * @param {string} sourcePath - Source file path
 * @param {string} destinationPath - Destination file path
 * @returns {Promise<boolean>} True if file was copied successfully
 */
const copyFile = async (sourcePath, destinationPath) => {
  try {
    // Ensure destination directory exists
    const destinationDir = path.dirname(destinationPath);
    await ensureDirectory(destinationDir);

    await fs.copyFile(sourcePath, destinationPath);
    return true;
  } catch (error) {
    throw new Error(`Failed to copy file from ${sourcePath} to ${destinationPath}: ${error.message}`);
  }
};

module.exports = {
  getFileExtension,
  getMimeTypeFromExtension,
  validateFileType,
  validateFileSize,
  generateFileHash,
  checkFileExists,
  deleteFile,
  deleteFiles,
  cleanupUploadedFiles,
  ensureDirectory,
  getFileStats,
  listFiles,
  moveFile,
  copyFile
};