const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
require('dotenv').config();

// Test script for bulk CRUD operations
async function testBulkOperations() {
    console.log('🧪 Starting Bulk Operations Tests...\n');

    try {
        // Connect to MongoDB
        const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/telcalling');
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db('telcalling');
        const leadsCollection = db.collection('leads');

        // Clear existing test data
        await leadsCollection.deleteMany({ phone: { $regex: '^\\+12345' } });
        console.log('🧹 Cleared existing test data');

        // Create test leads
        const testLeads = [
            {
                name: 'Test Lead 1',
                phone: '+1234567890',
                description: 'Test lead for bulk operations',
                website: 'https://example1.com',
                location: 'New York',
                sector: 'Technology',
                status: 'New',
                notes: 'Initial test lead',
                assignedTo: 'Unassigned',
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'Test Lead 2',
                phone: '+1234567891',
                description: 'Another test lead',
                website: 'https://example2.com',
                location: 'California',
                sector: 'Healthcare',
                status: 'Hot',
                notes: 'Hot lead for testing',
                assignedTo: 'Unassigned',
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'Test Lead 3',
                phone: '+1234567892',
                description: 'Third test lead',
                website: 'https://example3.com',
                location: 'Texas',
                sector: 'Finance',
                status: 'Pending',
                notes: 'Pending lead',
                assignedTo: 'Unassigned',
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];

        const insertedLeads = await leadsCollection.insertMany(testLeads);
        console.log(`✅ Created ${insertedLeads.insertedCount} test leads`);

        const leadIds = Object.values(insertedLeads.insertedIds);
        console.log('📋 Test Lead IDs:', leadIds.map(id => id.toString()));

        // Test 1: Bulk Update
        console.log('\n📝 Test 1: Bulk Update Operation');
        const updateResponse = await fetch('http://localhost:3000/api/v1/admin/leads/bulk-update', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.ADMIN_TOKEN || 'test-token'}`
            },
            body: JSON.stringify({
                leadIds: leadIds.map(id => id.toString()),
                updates: {
                    status: 'Interested',
                    sector: 'Technology',
                    notes: 'Updated via bulk operation test'
                }
            })
        });

        const updateResult = await updateResponse.json();
        console.log('Update Response Status:', updateResponse.status);
        console.log('Update Result:', JSON.stringify(updateResult, null, 2));

        if (updateResult.success) {
            console.log('✅ Bulk Update Test PASSED');
        } else {
            console.log('❌ Bulk Update Test FAILED');
        }

        // Test 2: Bulk Delete
        console.log('\n🗑️ Test 2: Bulk Delete Operation');
        const deleteResponse = await fetch('http://localhost:3000/api/v1/admin/leads/bulk-delete', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.ADMIN_TOKEN || 'test-token'}`
            },
            body: JSON.stringify({
                leadIds: leadIds.map(id => id.toString())
            })
        });

        const deleteResult = await deleteResponse.json();
        console.log('Delete Response Status:', deleteResponse.status);
        console.log('Delete Result:', JSON.stringify(deleteResult, null, 2));

        if (deleteResult.success) {
            console.log('✅ Bulk Delete Test PASSED');
        } else {
            console.log('❌ Bulk Delete Test FAILED');
        }

        // Test 3: Export Functionality
        console.log('\n📥 Test 3: Export Functionality');
        const exportResponse = await fetch('http://localhost:3000/api/v1/admin/leads/export?format=json', {
            headers: {
                'Authorization': `Bearer ${process.env.ADMIN_TOKEN || 'test-token'}`
            }
        });

        console.log('Export Response Status:', exportResponse.status);

        if (exportResponse.ok) {
            const exportData = await exportResponse.json();
            console.log('Export Result:', JSON.stringify(exportData, null, 2));
            console.log('✅ Export Test PASSED');
        } else {
            console.log('❌ Export Test FAILED');
            const errorText = await exportResponse.text();
            console.log('Error:', errorText);
        }

        // Cleanup - remove any remaining test data
        await leadsCollection.deleteMany({ phone: { $regex: '^\\+12345' } });
        console.log('🧹 Cleaned up test data');

        await client.close();
        console.log('🔌 Disconnected from MongoDB');

        console.log('\n🎉 All tests completed!');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        process.exit(1);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    testBulkOperations();
}

module.exports = { testBulkOperations };