const db = require('./database');

db.run(`ALTER TABLE deliveries ADD COLUMN receiver_name TEXT`, (err) => {
    if (err) {
        if (err.message.includes('duplicate column name')) {
            console.log('Column already exists.');
        } else {
            console.error('Error adding column:', err.message);
        }
    } else {
        console.log('Column added successfully.');
    }
});
