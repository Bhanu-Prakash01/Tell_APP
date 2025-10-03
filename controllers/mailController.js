require('dotenv').config();
const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');

function validateMailConfig(body){
    const errors = [];
    const { username, password, incomingServer, incomingPort, outgoingServer, outgoingPort, useTLS } = body || {};
    if(!username || typeof username !== 'string') errors.push('username is required');
    if(!password || typeof password !== 'string') errors.push('password is required');
    if(!incomingServer) errors.push('incomingServer is required');
    if(!incomingPort) errors.push('incomingPort is required');
    if(!outgoingServer) errors.push('outgoingServer is required');
    if(!outgoingPort) errors.push('outgoingPort is required');
    return { valid: errors.length===0, errors };
}

function getImapClient(config){
    const client = new ImapFlow({
        host: config.incomingServer,
        port: Number(config.incomingPort),
        secure: true, // IMAP over TLS 993
        auth: { user: config.username, pass: config.password },
        logger: false
    });
    return client;
}

async function withImap(config, fn){
    const client = getImapClient(config);
    try{
        await client.connect();
        const result = await fn(client);
        await client.logout();
        return result;
    }catch(err){
        try{ await client.logout(); }catch(_e){}
        throw err;
    }
}

function getSmtpTransport(config){
    const transporter = nodemailer.createTransport({
        host: config.outgoingServer,
        port: Number(config.outgoingPort),
        secure: true, // SMTP SSL 465
        auth: { user: config.username, pass: config.password }
    });
    return transporter;
}

module.exports = {
    async validate(req, res){
        try{
            const cfg = req.body;
            const { valid, errors } = validateMailConfig(cfg);
            if(!valid) return res.status(400).json({ error: 'Invalid config', details: errors });
            await withImap(cfg, async (client)=>{ await client.mailboxOpen('INBOX', { readOnly: true }); });
            const transporter = getSmtpTransport(cfg);
            await transporter.verify();
            res.json({ ok: true, message: 'IMAP/SMTP verified' });
        }catch(err){
            res.status(400).json({ error: 'Validation failed', details: err.message });
        }
    },

    async inbox(req, res){
        try{
            const cfg = req.body;
            const { valid, errors } = validateMailConfig(cfg);
            if(!valid) return res.status(400).json({ error: 'Invalid config', details: errors });
            const { page = 1, limit = 25, mailbox = 'INBOX' } = req.query;
            const offset = (Number(page)-1)*Number(limit);
            const messages = await withImap(cfg, async (client)=>{
                await client.mailboxOpen(mailbox, { readOnly: true });
                const box = client.mailbox;
                const seqStart = Math.max(1, box.exists - offset - Number(limit) + 1);
                const seqEnd = Math.max(1, box.exists - offset);
                if(box.exists === 0) return { items: [], total: 0 };
                const items = [];
                for await (let msg of client.fetch(`${seqStart}:${seqEnd}`, { envelope: true, internalDate: true, uid: true })){
                    items.push({
                        uid: msg.uid,
                        subject: msg.envelope?.subject || '(no subject)',
                        from: (msg.envelope?.from && msg.envelope.from[0]) ? `${msg.envelope.from[0].name || ''} <${msg.envelope.from[0].address}>` : '(unknown)',
                        date: msg.internalDate
                    });
                }
                items.sort((a,b)=> new Date(b.date) - new Date(a.date));
                return { items, total: box.exists };
            });
            res.json(messages);
        }catch(err){
            res.status(500).json({ error: 'Failed to fetch inbox', details: err.message });
        }
    },

    async message(req, res){
        try{
            const cfg = req.body;
            const { uid } = req.params;
            const { mailbox = 'INBOX' } = req.query;
            const { valid, errors } = validateMailConfig(cfg);
            if(!valid) return res.status(400).json({ error: 'Invalid config', details: errors });
            const detail = await withImap(cfg, async (client)=>{
                await client.mailboxOpen(mailbox);
                const parts = { envelope: true, bodyStructure: true, internalDate: true, uid: true }; 
                let meta = null;
                for await (const msg of client.fetch({ uid: Number(uid) }, parts)){
                    meta = msg;
                }
                if(!meta) return null;

                // Locate body parts for html/plain
                function findBodyParts(node){
                    let htmlPart = null;
                    let textPart = null;
                    function walk(n){
                        if(!n) return;
                        if(Array.isArray(n)) return n.forEach(walk);
                        const mime = `${n.type||''}/${n.subtype||''}`.toLowerCase();
                        if(mime === 'text/html' && !htmlPart) htmlPart = n.part || n.id || null;
                        if(mime === 'text/plain' && !textPart) textPart = n.part || n.id || null;
                        if(n.childNodes) n.childNodes.forEach(walk);
                        if(n.children) n.children.forEach(walk);
                        if(n.parts) n.parts.forEach(walk);
                    }
                    walk(node);
                    return { htmlPart, textPart };
                }

                async function downloadPart(partId){
                    try{
                        const dl = partId ? await client.download({ uid: Number(uid), part: partId }) : await client.download({ uid: Number(uid) });
                        const content = dl.content;
                        return await new Promise((resolve, reject)=>{
                            let buf='';
                            content.setEncoding('utf8');
                            content.on('data',(c)=> buf+=c);
                            content.on('end',()=> resolve(buf));
                            content.on('error',reject);
                        });
                    }catch(err){
                        return '';
                    }
                }

                const { htmlPart, textPart } = findBodyParts(meta.bodyStructure);
                const html = htmlPart ? await downloadPart(htmlPart) : '';
                const text = textPart ? await downloadPart(textPart) : '';
                let raw = html || text;
                if(!raw){ raw = await downloadPart(null); }

                // Collect attachments metadata
                function collectAttachments(struct){
                    const out=[];
                    function walk(node, path){
                        if(!node) return;
                        if(Array.isArray(node)) return node.forEach((n,i)=> walk(n, `${path}.${i}`));
                        const dispType = (typeof node.disposition === 'string' ? node.disposition : node.disposition?.type || '').toLowerCase();
                        const filename = node.parameters?.name || node.disposition?.parameters?.filename || node.disposition?.params?.filename || node.params?.name;
                        const hasFilename = !!filename;
                        if(dispType==='attachment' || (dispType==='inline' && hasFilename)){
                            out.push({
                                part: node.part || path,
                                filename: filename || 'attachment',
                                mimeType: `${node.type}/${node.subtype}`,
                                size: node.size || 0
                            });
                        }
                        if(node.childNodes) node.childNodes.forEach((c,i)=> walk(c, `${path}.${i}`));
                        if(node.children) node.children.forEach((c,i)=> walk(c, `${path}.${i}`));
                    }
                    walk(struct,'1');
                    return out;
                }
                const attachments = collectAttachments(meta.bodyStructure);
                return {
                    uid: meta?.uid,
                    subject: meta?.envelope?.subject || '(no subject)',
                    from: (meta?.envelope?.from && meta.envelope.from[0]) ? `${meta.envelope.from[0].name || ''} <${meta.envelope.from[0].address}>` : '(unknown)',
                    date: meta?.internalDate,
                    html,
                    text,
                    raw,
                    attachments
                };
            });
            res.json(detail);
        }catch(err){
            res.status(500).json({ error: 'Failed to fetch message', details: err.message });
        }
    },

    async send(req, res){
        try{
            const { to, subject, text, html, cc, bcc, username, password, outgoingServer, outgoingPort, attachments } = req.body || {};
            const cfg = { username, password, outgoingServer, outgoingPort };
            const { valid } = validateMailConfig({ username, password, incomingServer: 'x', incomingPort: 993, outgoingServer, outgoingPort });
            if(!valid) return res.status(400).json({ error: 'Invalid config' });
            if(!to) return res.status(400).json({ error: 'Recipient is required' });
            const transporter = getSmtpTransport(cfg);
            const nodemailerAttachments = Array.isArray(attachments) ? attachments.map(a=>({ filename: a.filename, content: Buffer.from(a.content||'', 'base64'), contentType: a.contentType || 'application/octet-stream' })) : undefined;
            const info = await transporter.sendMail({ from: username, to, subject: subject||'', text, html, cc, bcc, attachments: nodemailerAttachments });
            res.json({ ok: true, messageId: info.messageId });
        }catch(err){
            res.status(500).json({ error: 'Failed to send email', details: err.message });
        }
    },

    async del(req, res){
        try{
            const cfg = req.body;
            const { uid } = req.params;
            const { valid, errors } = validateMailConfig(cfg);
            if(!valid) return res.status(400).json({ error: 'Invalid config', details: errors });
            await withImap(cfg, async (client)=>{
                await client.mailboxOpen('INBOX');
                // Move to Trash if exists
                try { await client.messageMove({ uid: Number(uid) }, 'Trash', { uid: true }); }
                catch(_e){ await client.messageDelete({ uid: Number(uid) }, { uid: true }); }
            });
            res.json({ ok: true });
        }catch(err){
            res.status(500).json({ error: 'Failed to delete email', details: err.message });
        }
    },

    async folders(req, res){
        try{
            const cfg = req.body;
            const { valid, errors } = validateMailConfig(cfg);
            if(!valid) return res.status(400).json({ error: 'Invalid config', details: errors });
            const data = await withImap(cfg, async (client)=>{
                const boxes = [];
                for await (let box of client.list()){
                    boxes.push({ path: box.path, name: box.name, flags: box.flags });
                }
                return boxes;
            });
            res.json({ folders: data });
        }catch(err){
            res.status(500).json({ error: 'Failed to list folders', details: err.message });
        }
    },

    async search(req, res){
        try{
            const cfg = req.body;
            const { mailbox = 'INBOX', q, from, subject, since, before } = req.query;
            const { valid, errors } = validateMailConfig(cfg);
            if(!valid) return res.status(400).json({ error: 'Invalid config', details: errors });
            const result = await withImap(cfg, async (client)=>{
                await client.mailboxOpen(mailbox, { readOnly: true });
                const criteria = [];
                if(q) criteria.push(['OR', ['FROM', q], ['SUBJECT', q]]);
                if(from) criteria.push(['FROM', from]);
                if(subject) criteria.push(['SUBJECT', subject]);
                if(since) criteria.push(['SINCE', new Date(since)]);
                if(before) criteria.push(['BEFORE', new Date(before)]);
                const uids = await client.search(criteria.length?criteria:['ALL']);
                const items = [];
                for await (let msg of client.fetch({ uid: uids }, { envelope: true, internalDate: true, uid: true })){
                    items.push({ uid: msg.uid, subject: msg.envelope?.subject||'', from: (msg.envelope?.from&&msg.envelope.from[0])?`${msg.envelope.from[0].name||''} <${msg.envelope.from[0].address}>`:'', date: msg.internalDate });
                }
                items.sort((a,b)=> new Date(b.date)-new Date(a.date));
                return { items, total: items.length };
            });
            res.json(result);
        }catch(err){
            res.status(500).json({ error: 'Search failed', details: err.message });
        }
    },

    async attachment(req, res){
        try{
            const cfg = req.body;
            const { uid } = req.params;
            const { part, mailbox = 'INBOX' } = req.query;
            const { valid, errors } = validateMailConfig(cfg);
            if(!valid) return res.status(400).json({ error: 'Invalid config', details: errors });
            const data = await withImap(cfg, async (client)=>{
                await client.mailboxOpen(mailbox);
                const dl = await client.download({ uid: Number(uid), part });
                const filename = dl?.contentDisposition?.params?.filename || dl?.filename || 'attachment';
                const mimeType = dl?.contentType?.value || 'application/octet-stream';
                const buf = await new Promise((resolve, reject)=>{
                    const chunks=[]; dl.content.on('data',c=>chunks.push(c)); dl.content.on('end',()=> resolve(Buffer.concat(chunks))); dl.content.on('error',reject);
                });
                return { filename, mimeType, b64: buf.toString('base64') };
            });
            res.json(data);
        }catch(err){
            res.status(500).json({ error: 'Attachment fetch failed', details: err.message });
        }
    },

    async moveToTrash(req, res){
        try{
            const cfg = req.body;
            const { uid } = req.params;
            const { mailbox = 'INBOX' } = req.query;
            const { valid, errors } = validateMailConfig(cfg);
            if(!valid) return res.status(400).json({ error: 'Invalid config', details: errors });
            await withImap(cfg, async (client)=>{
                await client.mailboxOpen(mailbox);
                await client.messageMove({ uid: Number(uid) }, 'Trash', { uid: true });
            });
            res.json({ ok: true });
        }catch(err){
            res.status(500).json({ error: 'Move to trash failed', details: err.message });
        }
    }
};


