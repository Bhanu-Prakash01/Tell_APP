const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');
const Mail = require('../controllers/mailController');

// All routes require admin
router.use(auth);
router.use(roles(['admin']));

// Validate IMAP/SMTP credentials
router.post('/validate', Mail.validate);

// List inbox (requires credentials in body)
router.post('/inbox', Mail.inbox);

// Get message detail by UID
router.post('/message/:uid', Mail.message);

// Send email via SMTP
router.post('/send', Mail.send);

// Delete email
router.post('/delete/:uid', Mail.del);

// Folders
router.post('/folders', Mail.folders);

// Search
router.post('/search', Mail.search);

// Attachment download (returns base64 with metadata)
router.post('/attachment/:uid', Mail.attachment);

// Move to Trash
router.post('/trash/:uid', Mail.moveToTrash);

module.exports = router;


