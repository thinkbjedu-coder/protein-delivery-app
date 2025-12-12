const { Pool } = require('pg');

// データベース接続プール
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// データベースの初期化
async function initDatabase() {
    const client = await pool.connect();
    try {
        console.log('PostgreSQLデータベースを初期化中...');

        // 送付記録テーブル
        await client.query(`
            CREATE TABLE IF NOT EXISTS deliveries (
                id SERIAL PRIMARY KEY,
                date TEXT NOT NULL,
                from_branch TEXT NOT NULL,
                to_branch TEXT NOT NULL,
                type TEXT NOT NULL,
                status TEXT DEFAULT 'sent',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                received_at TIMESTAMP,
                received_by TEXT
            );
        `);

        // 品目テーブル
        await client.query(`
            CREATE TABLE IF NOT EXISTS delivery_items (
                id SERIAL PRIMARY KEY,
                delivery_id INTEGER REFERENCES deliveries(id) ON DELETE CASCADE,
                item_name TEXT NOT NULL,
                quantity INTEGER NOT NULL
            );
        `);

        console.log('データベース初期化完了');
    } catch (error) {
        console.error('データベース初期化エラー:', error);
        throw error; // 初期化失敗は致命的なので再スロー
    } finally {
        client.release();
    }
}

// 送付記録の作成
async function createDelivery(deliveryData) {
    const { date, fromBranch, toBranch, type, items } = deliveryData;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 送付記録を追加
        const deliveryResult = await client.query(
            `INSERT INTO deliveries (date, from_branch, to_branch, type, status, created_at)
             VALUES ($1, $2, $3, $4, 'sent', NOW())
             RETURNING id`,
            [date, fromBranch, toBranch, type]
        );
        const deliveryId = deliveryResult.rows[0].id;

        // 品目を追加
        for (const item of items) {
            await client.query(
                `INSERT INTO delivery_items (delivery_id, item_name, quantity)
                 VALUES ($1, $2, $3)`,
                [deliveryId, item.name, item.quantity]
            );
        }

        await client.query('COMMIT');
        return deliveryId;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('データ作成エラー:', error);
        throw error;
    } finally {
        client.release();
    }
}

// 送付記録の一覧取得
async function getDeliveries(filters = {}) {
    try {
        // 基本のクエリ構築
        let query = 'SELECT * FROM deliveries WHERE 1=1';
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

        // 日付フィルタ（文字列比較）
        if (filters.dateFrom) {
            query += ` AND date >= $${paramIndex}`;
            params.push(filters.dateFrom);
            paramIndex++;
        }

        if (filters.dateTo) {
            query += ` AND date <= $${paramIndex}`;
            params.push(filters.dateTo);
            paramIndex++;
        }

        query += ' ORDER BY created_at DESC';

        const result = await pool.query(query, params);
        let deliveries = result.rows;

        // 品目情報を取得して結合
        for (let delivery of deliveries) {
            const itemsResult = await pool.query(
                'SELECT item_name, quantity FROM delivery_items WHERE delivery_id = $1',
                [delivery.id]
            );

            // フォーマットして結合 (元の仕様に合わせる: "品名 (x数量)")
            delivery.items = itemsResult.rows
                .map(item => `${item.item_name} (x${item.quantity})`)
                .join(', ');

            // クライアント互換性のため生の配列も持たせておく場合は検討が必要だが、
            // server.jsを見る限り検索フィルタで文字列として使われている。
            // 詳細表示(getDeliveryById)では配列が必要だが、一覧(getDeliveries)では文字列でOK。
            // ただし、getDeliveriesの結果もフロントで items.map したりしてる？
            // script.jsのrenderHistoryを見ると:
            // const itemsText = Array.isArray(delivery.items) ? delivery.items.map(i => i.name).join(', ') : (delivery.items || '-');
            // とあり、文字列でも配列でも対応できそう。ここでは文字列にしておくと検索フィルタロジック(server.jsママ)が動く。

            // server.jsの検索ロジック:
            // if (filters.search) { results = results.filter(d => d.items && d.items.toLowerCase().includes(...)) }
            // なので、delivery.items は文字列である必要がある。
        }

        // 検索フィルタ (DB検索ではなくメモリ上で実行)
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            deliveries = deliveries.filter(d =>
                d.items && d.items.toLowerCase().includes(searchLower)
            );
        }

        return deliveries;
    } catch (error) {
        console.error('データ取得エラー:', error);
        throw error;
    }
}

// 特定の送付記録を取得
async function getDeliveryById(id) {
    try {
        const deliveryResult = await pool.query('SELECT * FROM deliveries WHERE id = $1', [id]);
        if (deliveryResult.rows.length === 0) return null;

        const delivery = deliveryResult.rows[0];

        // アイテム詳細を取得
        const itemsResult = await pool.query(
            'SELECT item_name as name, quantity FROM delivery_items WHERE delivery_id = $1',
            [id]
        );

        // script.jsのviewDetailでは delivery.items.map をしているので、ここでは配列を返す
        delivery.items = itemsResult.rows;

        return delivery;
    } catch (error) {
        console.error('詳細取得エラー:', error);
        throw error;
    }
}

// 受領確認
async function markAsReceived(id, receivedBy) {
    try {
        const result = await pool.query(
            `UPDATE deliveries 
             SET status = 'received', received_at = NOW(), received_by = $2
             WHERE id = $1
             RETURNING id`,
            [id, receivedBy]
        );

        return { changes: result.rowCount };
    } catch (error) {
        console.error('受領更新エラー:', error);
        throw error;
    }
}

// 送付記録の削除
async function deleteDelivery(id) {
    try {
        // ON DELETE CASCADEを設定しているので、itemsは自動消滅するはずだが、念のため
        const result = await pool.query('DELETE FROM deliveries WHERE id = $1', [id]);
        return { changes: result.rowCount };
    } catch (error) {
        console.error('削除エラー:', error);
        throw error;
    }
}

// 事業所一覧を取得 (変更なし)
function getBranches() {
    return [
        "法人本部",
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
