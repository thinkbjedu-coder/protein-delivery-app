const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'deliveries.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1); // Exit if database cannot be opened
    } else {
        console.log('Connected to the SQLite database.');
        // Configure database for better concurrency
        db.configure('busyTimeout', 5000); // Wait up to 5 seconds for locks
        initSchema();
    }
});

function initSchema() {
    db.run(`CREATE TABLE IF NOT EXISTS deliveries (
        id TEXT PRIMARY KEY,
        status TEXT DEFAULT '作成済み',
        from_site TEXT DEFAULT '本部',
        to_site TEXT NOT NULL,
        items TEXT NOT NULL,
        received_check INTEGER DEFAULT 0,
        received_at TEXT,
        receiver_name TEXT,
        note TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating table:', err.message);
        } else {
            console.log('Table "deliveries" ready.');
        }
    });
}

module.exports = db;
