const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./database');
const { syncToSheet } = require('./sheets');

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Health check endpoint for cloud services
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV
    });
});

// Generate ID: YYYYMMDD-###
function generateId(callback) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const datePrefix = `${yyyy}${mm}${dd}`;

    db.get(`SELECT id FROM deliveries WHERE id LIKE ? ORDER BY id DESC LIMIT 1`, [`${datePrefix}-%`], (err, row) => {
        if (err) {
            callback(err, null);
            return;
        }
        let nextNum = 1;
        if (row) {
            const parts = row.id.split('-');
            if (parts.length === 2) {
                nextNum = parseInt(parts[1], 10) + 1;
            }
        }
        const newId = `${datePrefix}-${String(nextNum).padStart(3, '0')}`;
        callback(null, newId);
    });
}

// GET all deliveries
app.get('/api/deliveries', (req, res) => {
    db.all(`SELECT * FROM deliveries ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        // Parse items JSON for each row
        const parsed = rows.map(row => {
            try {
                row.items = JSON.parse(row.items || '[]');
            } catch (e) {
                row.items = [];
            }
            return row;
        });
        res.json(parsed);
    });
});

// POST new delivery
app.post('/api/deliveries', (req, res) => {
    const { to_site, items, note } = req.body; // items is array: [{item, qty}, ...]
    generateId((err, newId) => {
        if (err) {
            res.status(500).json({ error: "Failed to generate ID" });
            return;
        }
        const itemsJson = JSON.stringify(items);
        const stmt = db.prepare(`INSERT INTO deliveries (id, from_site, to_site, items, note, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))`);
        stmt.run(newId, '本部', to_site, itemsJson, note, function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            const newRecord = {
                id: newId,
                status: '作成済み',
                from_site: '本部',
                to_site,
                items,
                received_check: 0,
                received_at: null,
                note,
                created_at: new Date().toISOString()
            };
            syncToSheet(newRecord).catch(console.error);

            res.json(newRecord);
        });
        stmt.finalize();
    });
});

// POST login
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === 'think0305') {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Invalid password' });
    }
});

// PATCH receive
app.patch('/api/deliveries/:id/receive', (req, res) => {
    const { id } = req.params;
    const { receiver_name } = req.body;
    const received_at = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    db.run(`UPDATE deliveries SET status = ?, received_check = 1, received_at = ?, receiver_name = ? WHERE id = ?`,
        ['受領済み', received_at, receiver_name, id],
        function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            db.get(`SELECT * FROM deliveries WHERE id = ?`, [id], (err, row) => {
                if (!err && row) {
                    syncToSheet(row).catch(console.error);
                }
                res.json({ message: "Received", received_at, receiver_name });
            });
        }
    );
});

// GET CSV export (must be before :id routes to avoid route conflicts)
app.get('/api/export/csv', (req, res) => {
    db.all(`SELECT * FROM deliveries ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        // CSV Header
        let csv = '伝票番号,状態,出庫元,入庫先,品目,受領チェック,受領日,受取人,備考,作成日時\n';

        rows.forEach(row => {
            // Parse items if it's JSON
            let itemsDisplay = '';
            try {
                const items = JSON.parse(row.items || '[]');
                itemsDisplay = items.map(i => `${i.item}(${i.qty}袋)`).join('; ');
            } catch (e) {
                // Fallback for old format
                itemsDisplay = `${row.item || ''}(${row.qty || 0}袋)`;
            }

            csv += `${row.id},${row.status},${row.from_site},${row.to_site},"${itemsDisplay}","${row.received_check ? 'はい' : 'いいえ'}",${row.received_at || ''},${row.receiver_name || ''},"${(row.note || '').replace(/"/g, '""')}",${row.created_at}\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=deliveries.csv');
        res.send('\uFEFF' + csv); // BOM for Excel UTF-8
    });
});

// DELETE delivery
app.delete('/api/deliveries/:id', (req, res) => {
    const { id } = req.params;

    db.run(`DELETE FROM deliveries WHERE id = ?`, [id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Delivery not found' });
            return;
        }
        res.json({ message: 'Deleted successfully' });
    });
});

const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${NODE_ENV}`);
});

// Global error handlers
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Log the error but don't exit immediately in production
    if (NODE_ENV !== 'production') {
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Log the error but don't exit in production
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);

    server.close(() => {
        console.log('HTTP server closed');

        // Close database connection
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
                process.exit(1);
            }
            console.log('Database connection closed');
            process.exit(0);
        });
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
