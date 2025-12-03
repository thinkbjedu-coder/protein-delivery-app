const db = require('./database');

// Add items column and remove old item/qty columns
db.serialize(() => {
    // First, check if items column exists
    db.all(`PRAGMA table_info(deliveries)`, [], (err, columns) => {
        if (err) {
            console.error('Error checking schema:', err);
            return;
        }

        const hasItems = columns.some(col => col.name === 'items');

        if (!hasItems) {
            console.log('Migrating to new schema...');

            // Add items column
            db.run(`ALTER TABLE deliveries ADD COLUMN items TEXT`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding items column:', err);
                } else {
                    console.log('Items column added.');

                    // Migrate existing data
                    db.run(`UPDATE deliveries SET items = json_array(json_object('item', item, 'qty', qty)) WHERE items IS NULL`, (err) => {
                        if (err) {
                            console.error('Error migrating data:', err);
                        } else {
                            console.log('Data migrated successfully.');
                        }
                    });
                }
            });
        } else {
            console.log('Schema already up to date.');
        }
    });
});
