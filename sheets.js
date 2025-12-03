// Placeholder for Google Sheets API
// Requires service account credentials

async function syncToSheet(record) {
    console.log("Syncing to Google Sheet (Simulation):", record);
    // TODO: Implement actual Google Sheets API logic here
    // 1. Load credentials
    // 2. Auth with googleapis
    // 3. Append or Update row in '納品書' sheet

    /*
    const { google } = require('googleapis');
    const auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    // ... implementation ...
    */
}

module.exports = { syncToSheet };
