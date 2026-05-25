# Quick Start Guide - Local Development

## Prerequisites
- Python 3.9+
- Node.js 18+
- npm or yarn
- SQLite3 (built-in with Python)

---

## 🚀 Running the Application Locally

### Terminal 1: Backend API
```bash
cd MailAlert
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

**Expected Output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

**Test Backend:** http://127.0.0.1:8000/health

---

### Terminal 2: WhatsApp Gateway
```bash
cd MailAlert/whatsapp-gateway
npm install
npm start
```

**Expected Output:**
```
Server running on http://localhost:3001
WhatsApp gateway ready
```

**Test Gateway:** http://127.0.0.1:3001/health

---

### Terminal 3: Frontend
```bash
cd MailAlert/frontend
npm install
npm run dev
```

**Expected Output:**
```
  VITE v6.4.2  ready in 245 ms

  ➜  Local:   http://127.0.0.1:5173/
```

---

## 🔐 Test Login

**URL**: http://127.0.0.1:5173

**Credentials**:
- **Email**: `vynoraautomations@gmail.com`
- **Password**: `change-this-admin-password`

---

## 📱 Test WhatsApp Flow

### Step 1: Login
- Go to http://127.0.0.1:5173
- Enter admin credentials
- Click "Login"

### Step 2: Navigate to Admin Dashboard
- Click "Admin" in sidebar
- Scroll to "WhatsApp Control Center"

### Step 3: Connect WhatsApp
- Click "Connect WhatsApp" button
- QR code modal should appear
- Open WhatsApp on your phone and scan the QR code
- Modal should auto-close when connected
- Status should change to "🟢 ONLINE"

### Step 4: Verify Status
- Green pulsing dot indicates connected
- Refresh page → Status should persist

### Step 5: Disconnect
- Click "Disconnect WhatsApp" button
- Confirmation dialog appears
- Click "Confirm" to disconnect
- Status should change to "🔴 OFFLINE"

---

## 🧪 API Testing

### Login
```bash
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "vynoraautomations@gmail.com",
    "password": "change-this-admin-password"
  }'
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

### Get WhatsApp Status
```bash
# Use the access_token from login response
curl -X GET http://127.0.0.1:8000/api/whatsapp/connection-status \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Connect WhatsApp
```bash
curl -X POST http://127.0.0.1:8000/api/whatsapp/connect \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Get QR Code
```bash
curl -X GET http://127.0.0.1:8000/api/admin/whatsapp/status \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🐛 Troubleshooting

### Backend Won't Start
**Error**: `ModuleNotFoundError: No module named 'backend'`
- Solution: Make sure you're in the `MailAlert` directory
- Run: `python -m uvicorn backend.app.main:app --reload`

**Error**: `Port 8000 already in use`
- Solution: Kill the process or use a different port
- Command: `netstat -ano | findstr :8000` (Windows)
- Then: `taskkill /PID <PID> /F`

---

### Gateway Won't Start
**Error**: `Port 3001 already in use`
- Solution: Kill the process
- Command: `lsof -i :3001` (macOS/Linux) or `netstat -ano | findstr :3001` (Windows)

**Error**: `Cannot find module 'whatsapp-web.js'`
- Solution: Install dependencies
- Run: `npm install` in `whatsapp-gateway` folder

---

### Frontend Won't Load
**Error**: `VITE v6.4.2: Port 5173 is in use`
- Solution: Use a different port
- Run: `npm run dev -- --port 5174`

**Error**: `Cannot find module 'react'`
- Solution: Install dependencies
- Run: `npm install` in `frontend` folder

---

### QR Modal Not Appearing
1. Check browser console (F12) for errors
2. Verify gateway is running on 3001: http://127.0.0.1:3001/health
3. Check backend logs for errors
4. Try refreshing the page and clicking again

---

### WhatsApp Not Connecting
1. Ensure phone has WhatsApp app installed
2. Check QR code is visible and not expired (expires after 2 minutes)
3. Make sure phone is on the same network or can reach the gateway
4. Try disconnecting and reconnecting
5. Restart gateway if stuck

---

## 🔍 Database Access

### View Admin User
```bash
python -c "
import sqlite3
conn = sqlite3.connect('dev.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
admin = cur.execute('SELECT * FROM users WHERE email=\"vynoraautomations@gmail.com\"').fetchone()
print(f'Email: {admin[\"email\"]}')
print(f'Phone: {admin[\"phone_number\"]}')
print(f'Is Admin: {admin[\"is_admin\"]}')
conn.close()
"
```

### Reset Database
```bash
# Delete old database
rm dev.db  # macOS/Linux
del dev.db # Windows

# Restart backend to recreate (will seed admin)
```

---

## 📋 Checklist Before Deployment

- [ ] Backend running without errors
- [ ] Gateway running and QR generation working
- [ ] Frontend builds successfully (`npm run build`)
- [ ] Admin login works
- [ ] WhatsApp QR modal appears and closes
- [ ] Connectivity status shows correctly
- [ ] Disconnect works with confirmation
- [ ] API endpoints return correct responses
- [ ] Database has admin user
- [ ] Payment number is 8106944811
- [ ] No console errors in browser
- [ ] Security headers present in response

---

## 📝 Useful Commands

```bash
# Check if ports are in use
netstat -ano | findstr :8000  # Windows
lsof -i :8000                 # macOS/Linux

# View all processes
tasklist | findstr python     # Windows
ps aux | grep python          # macOS/Linux

# Kill process by port
taskkill /F /IM python.exe    # Windows (careful!)
kill -9 $(lsof -t -i :8000)   # macOS/Linux

# Check backend logs
tail -f backend.log           # macOS/Linux

# Database commands
sqlite3 dev.db ".tables"      # Show all tables
sqlite3 dev.db "SELECT COUNT(*) FROM users;"  # Count users
```

---

## 🎯 Success Indicators

✅ All three services running without errors
✅ Can login with admin credentials
✅ QR modal appears when clicking "Connect WhatsApp"
✅ Modal closes automatically after scanning or timeout
✅ Connectivity status indicator shows correct state
✅ Disconnect works with confirmation dialog
✅ No browser console errors
✅ No backend error logs

---

**You're all set! The application is ready for deployment.** 🚀
