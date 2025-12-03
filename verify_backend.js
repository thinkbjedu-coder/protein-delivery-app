const db = require('./database');

console.log('Starting DB Verification...');

const testId = 'TEST-9999';
const testItem = JSON.stringify([{ item: 'TestItem', qty: 1 }]);

// 1. Insert Test
const stmt = db.prepare(`INSERT INTO deliveries (id, from_site, to_site, items, note, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))`);
stmt.run(testId, 'TestFrom', 'TestTo', testItem, 'TestNote', function (err) {
    if (err) {
        console.error('❌ Insert Failed:', err.message);
        process.exit(1);
    }
    console.log('✅ Insert Successful');

    // 2. Select Test
    db.get(`SELECT * FROM deliveries WHERE id = ?`, [testId], (err, row) => {
        if (err) {
            console.error('❌ Select Failed:', err.message);
            process.exit(1);
        }
        if (!row) {
            console.error('❌ Select Failed: Row not found');
            process.exit(1);
        }
        console.log('✅ Select Successful');

        // 3. Delete Test
        db.run(`DELETE FROM deliveries WHERE id = ?`, [testId], function (err) {
            if (err) {
                console.error('❌ Delete Failed:', err.message);
                process.exit(1);
            }
            if (this.changes === 0) {
                console.error('❌ Delete Failed: No rows deleted');
                process.exit(1);
            }
            console.log('✅ Delete Successful');
            console.log('🎉 All Backend Tests Passed!');
        });
    });
});
stmt.finalize();
