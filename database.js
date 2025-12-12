const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString: isProduction ? connectionString : undefined,
    ssl: isProduction ? { rejectUnauthorized: false } : false
});

// データベース初期化
async function initDatabase() {
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
