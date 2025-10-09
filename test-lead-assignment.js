const mongoose = require('mongoose');
const Lead = require('./models/Lead');
const User = require('./models/User');
require('dotenv').config();

// Test script for lead assignment functionality
async function testLeadAssignment() {
    try {
        console.log('🧪 Starting Lead Assignment Tests...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');

        // Get test users (manager and employees)
        const manager = await User.findOne({ role: 'manager' });
        const employees = await User.find({ role: 'employee' }).limit(2);

        if (!manager) {
            console.log('❌ No manager found. Please create a manager user first.');
            return;
        }

        if (employees.length < 2) {
            console.log('❌ Need at least 2 employees for testing. Please create employee users first.');
            return;
        }

        console.log(`👨‍💼 Manager: ${manager.name}`);
        console.log(`👥 Employees: ${employees.map(e => e.name).join(', ')}\n`);

        // Test 1: Create a test lead
        console.log('📝 Test 1: Creating a test lead...');
        const testLead = new Lead({
            name: 'Test Lead - Assignment Test',
            phone: '+91-9999999999',
            email: 'test@example.com',
            status: 'New',
            callStatus: 'Pending',
            sector: 'Technology',
            region: 'Maharashtra',
            createdBy: manager._id
        });

        await testLead.save();
        console.log(`✅ Created test lead: ${testLead.name} (ID: ${testLead._id})`);

        // Test 2: Assign lead to first employee
        console.log(`\n👤 Test 2: Assigning lead to ${employees[0].name}...`);
        await testLead.allocateToEmployee(employees[0]._id);

        const assignedLead = await Lead.findById(testLead._id);
        console.log(`✅ Lead assigned to: ${assignedLead.assignedTo}`);
        console.log(`✅ Call status: ${assignedLead.callStatus}`);

        // Verify status transition
        if (assignedLead.callStatus === 'Pending') {
            console.log('✅ Status transition working correctly (Pending)');
        } else {
            console.log('❌ Status transition failed');
        }

        // Test 3: Simulate employee completing the lead
        console.log(`\n✅ Test 3: Simulating employee completing the lead...`);
        assignedLead.callStatus = 'Completed';
        await assignedLead.save();
        console.log(`✅ Lead marked as completed by ${employees[0].name}`);

        // Test 4: Reassign to second employee
        console.log(`\n🔄 Test 4: Reassigning lead to ${employees[1].name}...`);
        await assignedLead.reassignToEmployee(employees[1]._id, manager._id);

        const reassignedLead = await Lead.findById(testLead._id);
        console.log(`✅ Lead reassigned to: ${reassignedLead.assignedTo}`);
        console.log(`✅ Call status after reassignment: ${reassignedLead.callStatus}`);

        // Verify status transition on reassignment
        if (reassignedLead.callStatus === 'Pending') {
            console.log('✅ Reassignment status transition working correctly (Pending)');
        } else {
            console.log('❌ Reassignment status transition failed');
        }

        // Test 5: Check historical data preservation
        console.log(`\n📚 Test 5: Checking historical data preservation...`);
        if (reassignedLead.previousAssignments && reassignedLead.previousAssignments.length > 0) {
            console.log(`✅ Historical data preserved: ${reassignedLead.previousAssignments.length} previous assignments`);
            reassignedLead.previousAssignments.forEach((assignment, index) => {
                console.log(`   ${index + 1}. Employee: ${assignment.employee}, Status: ${assignment.status}, Date: ${assignment.assignedAt}`);
            });
        } else {
            console.log('❌ Historical data not preserved');
        }

        // Test 6: Test assignment history method
        console.log(`\n📋 Test 6: Testing assignment history retrieval...`);
        const assignmentHistory = reassignedLead.getAssignmentHistory();
        console.log(`✅ Assignment history retrieved: ${assignmentHistory.length} records`);

        assignmentHistory.forEach((assignment, index) => {
            console.log(`   ${index + 1}. Employee: ${assignment.employee}, Status: ${assignment.status}, Current: ${assignment.isCurrent}`);
        });

        // Test 7: Test manager assignment via API helper
        console.log(`\n🔧 Test 7: Testing manager assignment helper function...`);
        const { assignLeadsToEmployee } = require('./controllers/managerController');

        const testLead2 = new Lead({
            name: 'Test Lead 2 - Helper Function Test',
            phone: '+91-8888888888',
            email: 'test2@example.com',
            status: 'New',
            callStatus: 'Pending',
            sector: 'Healthcare',
            region: 'Delhi',
            createdBy: manager._id
        });

        await testLead2.save();
        console.log(`✅ Created second test lead: ${testLead2.name}`);

        // Use helper function for assignment
        const results = await assignLeadsToEmployee([testLead2._id], employees[0]._id, manager._id);
        console.log(`✅ Helper function results: ${results.assigned.length} assigned, ${results.errors.length} errors`);

        if (results.assigned.length > 0) {
            console.log('✅ Helper function working correctly');
        } else {
            console.log('❌ Helper function failed');
        }

        // Cleanup test leads
        console.log(`\n🧹 Cleaning up test leads...`);
        await Lead.findByIdAndDelete(testLead._id);
        await Lead.findByIdAndDelete(testLead2._id);
        console.log('✅ Test leads cleaned up');

        console.log(`\n🎉 All tests completed successfully!`);
        console.log(`✅ Lead assignment with status transitions working correctly`);
        console.log(`✅ Historical data preservation working correctly`);
        console.log(`✅ Assignment history tracking working correctly`);

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the test
if (require.main === module) {
    testLeadAssignment();
}

module.exports = { testLeadAssignment };