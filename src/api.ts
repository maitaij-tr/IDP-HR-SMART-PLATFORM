import express from 'express';
import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();
const SPREADSHEET_ID = '1lsUtElA4l--ApLywH_kM8FJyBl0Tmk1jwKt9KpvDmoA';

// Helper to get Google Sheets client
async function getSheetsClient() {
  const credentialsString = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentialsString) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON environment variable");
  }
  
  let credentials;
  try {
    credentials = JSON.parse(credentialsString);
  } catch (error) {
    console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:", error);
    throw new Error("รูปแบบของ GOOGLE_SERVICE_ACCOUNT_JSON ไม่ถูกต้อง (ต้องเป็น JSON ที่ขึ้นต้นด้วย { และลงท้ายด้วย }) กรุณาตรวจสอบการคัดลอกอีกครั้ง");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client as any });
  return sheets;
}

// REGISTER API
router.post('/register', async (req, res) => {
  try {
    const { username, password, firstName = '' } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

    const sheets = await getSheetsClient();
    
    // Check if username already exists
    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'sheet user & password!B:B',
    });
    
    const users = getRes.data.values?.map(row => row[0]) || [];
    if (users.includes(username)) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Append new user to sheet user & password (A: BU, B: User, C: First Name, D: Password)
    const hashedPassword = Buffer.from(password).toString('base64');
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'sheet user & password!A:D',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['TR', username, firstName, hashedPassword]]
      }
    });

    res.json({ success: true, message: 'Registered successfully' });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ error: error.message });
  }
});

// LOGIN API
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

    const sheets = await getSheetsClient();
    
    // Get all users
    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'sheet user & password!A:D',
    });
    
    const rows = getRes.data.values || [];
    const userRow = rows.find(row => row[1] === username); // Column B is User
    
    if (!userRow) {
      return res.status(400).json({ error: 'User not found' });
    }
    
    const storedHash = userRow[3]; // Column D is Password
    const inputHash = Buffer.from(password).toString('base64');
    
    if (storedHash !== inputHash && storedHash !== password) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    // Create a simple token
    const token = Buffer.from(`session:${username}:${Date.now()}`).toString('base64');
    
    res.json({ success: true, token, username, firstName: userRow[2] || '' });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// SAVE LOG API
router.post('/savelog', async (req, res) => {
  try {
    const { logData } = req.body; // array of values matching the data log sheet
    
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'data log!A:P',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [logData]
      }
    });
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Save log error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
