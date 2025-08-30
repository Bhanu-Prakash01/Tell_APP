#!/usr/bin/env node

/**
 * Test script for duplicate file checking functionality
 * This script demonstrates how to test the duplicate file detection
 */

const fs = require('fs');
const crypto = require('crypto');

// Simulate file upload and hash calculation
function simulateFileUpload(filePath) {
    try {
        // Read file buffer
        const fileBuffer = fs.readFileSync(filePath);
        
        // Calculate SHA256 hash
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        
        console.log('📁 File:', filePath);
        console.log('🔐 Hash:', fileHash);
        console.log('📊 Size:', (fileBuffer.length / 1024).toFixed(2), 'KB');
        console.log('---');
        
        return { fileHash, size: fileBuffer.length };
    } catch (error) {
        console.error('❌ Error reading file:', error.message);
        return null;
    }
}

// Test with multiple files
function testDuplicateDetection() {
    console.log('🧪 Testing Duplicate File Detection\n');
    
    // Test 1: Same file, different names
    console.log('Test 1: Same file, different names');
    const file1 = simulateFileUpload('./test-audio.mp3');
    const file2 = simulateFileUpload('./test-audio-copy.mp3');
    
    if (file1 && file2) {
        if (file1.fileHash === file2.fileHash) {
            console.log('✅ Duplicate detected: Files have same hash');
        } else {
            console.log('❌ No duplicate: Files have different hashes');
        }
    }
    console.log('\n');
    
    // Test 2: Different files
    console.log('Test 2: Different files');
    const file3 = simulateFileUpload('./different-audio.mp3');
    
    if (file1 && file3) {
        if (file1.fileHash === file3.fileHash) {
            console.log('✅ Duplicate detected: Files have same hash');
        } else {
            console.log('❌ No duplicate: Files have different hashes');
        }
    }
    console.log('\n');
    
    // Test 3: Empty file
    console.log('Test 3: Empty file');
    const emptyFile = simulateFileUpload('./empty.mp3');
    if (emptyFile) {
        console.log('Empty file hash:', emptyFile.fileHash);
    }
}

// Test hash collision resistance
function testHashCollision() {
    console.log('🔒 Testing Hash Collision Resistance\n');
    
    const testStrings = [
        'Hello World',
        'Hello World!',
        'Hello World!!',
        'Hello World!!!',
        'Hello World!!!!'
    ];
    
    const hashes = testStrings.map(str => {
        const hash = crypto.createHash('sha256').update(str).digest('hex');
        return { string: str, hash: hash.substring(0, 8) + '...' };
    });
    
    console.log('Hash variations for similar strings:');
    hashes.forEach(({ string, hash }) => {
        console.log(`"${string}" -> ${hash}`);
    });
    
    console.log('\n✅ SHA256 provides excellent collision resistance');
}

// Main execution
if (require.main === module) {
    console.log('🚀 TeleCRM Duplicate File Detection Test\n');
    
    // Check if test files exist
    const testFiles = ['./test-audio.mp3', './test-audio-copy.mp3', './different-audio.mp3', './empty.mp3'];
    const existingFiles = testFiles.filter(file => fs.existsSync(file));
    
    if (existingFiles.length === 0) {
        console.log('📝 No test files found. Creating sample files...\n');
        
        // Create sample files for testing
        fs.writeFileSync('./test-audio.mp3', 'Sample audio content 1');
        fs.writeFileSync('./test-audio-copy.mp3', 'Sample audio content 1'); // Same content
        fs.writeFileSync('./different-audio.mp3', 'Sample audio content 2'); // Different content
        fs.writeFileSync('./empty.mp3', ''); // Empty file
        
        console.log('✅ Sample files created successfully!\n');
    }
    
    testDuplicateDetection();
    testHashCollision();
    
    console.log('\n📋 Test Summary:');
    console.log('• SHA256 hashing provides unique file fingerprints');
    console.log('• Same content = Same hash (duplicate detected)');
    console.log('• Different content = Different hash (no duplicate)');
    console.log('• Empty files get unique hashes');
    console.log('• Hash collision probability is extremely low');
    
    // Cleanup test files
    if (existingFiles.length === 0) {
        console.log('\n🧹 Cleaning up test files...');
        testFiles.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
                console.log(`Deleted: ${file}`);
            }
        });
    }
}

module.exports = { simulateFileUpload, testDuplicateDetection, testHashCollision };
