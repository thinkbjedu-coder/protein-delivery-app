// const { Pool } = require('pg'); // Only require if available
const fs = require('fs');
const path = require('path');

let Pool;
try {
    const pg = require('pg');
    Pool = pg.Pool;
} catch (e) {
    console.log('pg module not found, proceeding with mock DB only.');
    Pool = class MockPool { constructor() { } connect() { } }; // Dummy
}

const isProduction = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL;

let pool;
let isMock = false;
let mockDeliveries = []; // In-memory DB for local testing
const DATA_FILE = path.join(__dirname, 'deliveries.json');

// Load mock data from file
function loadMockData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            if (data.trim() === '') {
                mockDeliveries = [];
            } else {
                mockDeliveries = JSON.parse(data);
                if (!Array.isArray(mockDeliveries)) {
                    console.warn(`Warning: ${DATA_FILE} does not contain an array. Initializing as empty.`);
                    mockDeliveries = [];
                }
            }
            console.log(`Loaded ${mockDeliveries.length} deliveries from ${DATA_FILE}`);
        } else {
            mockDeliveries = [];
            console.log('No deliveries.json found, starting with empty data.');
        }
    } catch (error) {
        console.error('Error loading mock data:', error);
        mockDeliveries = [];
    }
}

// Save mock data to file
function saveMockData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(mockDeliveries, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving mock data:', error);
    }
}

if (connectionString && Pool) {
    pool = new Pool({
        connectionString: connectionString,
        ssl: isProduction ? { rejectUnauthorized: false } : false
    });

} else {
    // Fallback logic
    if (process.env.RENDER || process.env.NODE_ENV === 'production') {
        console.error('CRITICAL ERROR: DATABASE_URL is not set in production environment!');
        // We DO NOT want to silently fall back to local file in production as data will be lost.
        // However, to avoid crashing immediately if user is just testing, we log heavily.
    }

    console.log('No DATABASE_URL found or pg missing. Using local file persistence.');
    isMock = true;
    loadMockData();
}

// データベース初期化
async function initDatabase() {
    if (isMock) return; // No init needed for array
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS deliveries (
                id SERIAL PRIMARY KEY,
                date TEXT NOT NULL,
                from_branch TEXT NOT NULL,
                to_branch TEXT NOT NULL,
                type TEXT NOT NULL,
                items JSONB NOT NULL,
                status TEXT DEFAULT 'sent',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                received_at TIMESTAMP,
                received_by TEXT,
                note TEXT
            );
        `);
        // Add note column if it doesn't exist (for existing tables)
        await client.query(`ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS note TEXT;`);
        // Add items column if it doesn't exist (critical fix for production DB)
        await client.query(`ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS items JSONB;`);
    } finally {
        client.release();
    }
}

// 送付記録の作成
async function createDelivery(deliveryData) {
    if (isMock) {
        // Generate new ID (find max ID + 1)
        const maxId = mockDeliveries.reduce((max, d) => Math.max(max, d.id || 0), 0);
        const id = maxId + 1;

        // Save with snake_case to match Postgres schema and Frontend expectations
        const newDelivery = {
            id,
            date: deliveryData.date,
            from_branch: deliveryData.fromBranch,
            to_branch: deliveryData.toBranch,
            type: deliveryData.type,
            items: deliveryData.items,
            status: 'sent',
            note: deliveryData.note || '',
            created_at: new Date().toISOString(),
            received_at: null,
            received_by: null
        };

        mockDeliveries.push(newDelivery);
        saveMockData();
        return id;
    }

    const client = await pool.connect();
    try {
        const { date, fromBranch, toBranch, type, items } = deliveryData;
        const itemsJson = JSON.stringify(items);

        // 送付記録を追加
        const deliveryResult = await client.query(
            `INSERT INTO deliveries (date, from_branch, to_branch, type, items, status, note, created_at)
             VALUES ($1, $2, $3, $4, $5, 'sent', $6, NOW())
             RETURNING id`,
            [date, fromBranch, toBranch, type, itemsJson, deliveryData.note || '']
        );
        const deliveryId = deliveryResult.rows[0].id;

        return deliveryId;
    } finally {
        client.release();
    }
}

// 送付記録の一覧取得
async function getDeliveries(filters) {
    if (isMock) {
        let results = [...mockDeliveries];

        if (filters.branch) {
            results = results.filter(d => d.from_branch === filters.branch || d.to_branch === filters.branch);
        }
        if (filters.status) {
            results = results.filter(d => d.status === filters.status);
        }
        if (filters.search) {
            // Simple mock search
            results = results.filter(d => JSON.stringify(d.items).includes(filters.search));
        }
        // Descending order by ID (proxy for time)
        return results.sort((a, b) => b.id - a.id);
    }

    const client = await pool.connect();
    try {
        let query = `SELECT * FROM deliveries WHERE 1=1`;
        const params = [];
        let paramIndex = 1;

        if (filters.branch) {
            query += ` AND (from_branch = $${paramIndex} OR to_branch = $${paramIndex})`;
            params.push(filters.branch);
            paramIndex++;
        }

        if (filters.status) {
            query += ` AND status = $${paramIndex}`;
            params.push(filters.status);
            paramIndex++;
        }

        if (filters.search) {
            query += ` AND items::text LIKE $${paramIndex}`;
            params.push(`%${filters.search}%`);
            paramIndex++;
        }

        query += ` ORDER BY created_at DESC`;

        const result = await client.query(query, params);
        return result.rows;
    } finally {
        client.release();
    }
}

// 特定の送付記録を取得
async function getDeliveryById(id) {
    if (isMock) {
        return mockDeliveries.find(d => d.id == id);
    }

    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM deliveries WHERE id = $1', [id]);
        return result.rows[0];
    } finally {
        client.release();
    }
}

// 受領確認
async function markAsReceived(id, name) {
    if (isMock) {
        const delivery = mockDeliveries.find(d => d.id == id);
        if (delivery) {
            delivery.status = 'received';
            delivery.received_at = new Date().toISOString();
            delivery.received_by = name;
            saveMockData();
            return { rowCount: 1 };
        }
        return { rowCount: 0 };
    }

    const client = await pool.connect();
    try {
        const result = await client.query(
            `UPDATE deliveries 
             SET status = 'received', received_at = NOW(), received_by = $1
             WHERE id = $2`,
            [name, id]
        );
        return result;
    } finally {
        client.release();
    }
}

// 送付記録の削除
async function deleteDelivery(id) {
    if (isMock) {
        const idx = mockDeliveries.findIndex(d => d.id == id);
        if (idx !== -1) {
            mockDeliveries.splice(idx, 1);
            saveMockData();
            return { rowCount: 1 };
        }
        return { rowCount: 0 };
    }

    const client = await pool.connect();
    try {
        const result = await client.query('DELETE FROM deliveries WHERE id = $1', [id]);
        return result;
    } finally {
        client.release();
    }
}

// 事業所一覧を取得
function getBranches() {
    return [
        "本部",
        "リハビリフィットネス大永寺",
        "リハビリフィットネス守山",
        "リハビリフィットネス旭",
        "リハビリフィットネス長久手",
        "Co.メディカルフィットネス旭",
        "Life Up 可児",
        "Think Life守山",
        "Think Life大曽根",
        "Think Life旭",
        "Life Up 訪問看護ステーション可児",
        "訪問看護ステーション守山",
        "訪問看護ステーション旭"
    ];
}

module.exports = {
    initDatabase,
    createDelivery,
    getDeliveries,
    getDeliveryById,
    markAsReceived,
    deleteDelivery,
    getBranches
};
