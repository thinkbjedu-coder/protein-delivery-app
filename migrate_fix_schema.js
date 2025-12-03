const db = require('./database');

db.serialize(() => {
    console.log('Dropping obsolete columns...');
    db.run(`ALTER TABLE deliveries DROP COLUMN item`, (err) => {
        if (err) console.error('Error dropping item column:', err.message);
        else console.log('Dropped item column.');
    });
    db.run(`ALTER TABLE deliveries DROP COLUMN qty`, (err) => {
        if (err) console.error('Error dropping qty column:', err.message);
        else console.log('Dropped qty column.');
    });
});
