const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Parser = require('rss-parser');

const app = express();
app.use(cors());

const parser = new Parser();
let newsList = []; // שומר את החדשות האחרונות בזיכרון
let clients = []; // שומר את המשתמשים המחוברים (SSE)
const MAX_NEWS = 200; // הגבלת הידיעות בזיכרון כפי שאופיין

// רשימת מקורות (ניתן להוסיף/לשנות אתרי חדשות לפי הצורך)
const sources = [
    'https://www.jdn.co.il/feed/', // חדשות JDN לדוגמה
    'https://www.maariv.co.il/Rss/RssFeedsMivzakim' // מבזקים לדוגמה
];
let currentSourceIndex = 0;

// ==========================================
// חלק 1: נקודות קצה בשרת (API Endpoints)
// ==========================================

// 1. קבלת החדשות האחרונות (למשתמש שרק עכשיו פתח את התוסף)
app.get('/', (req, res) => {
    res.json(newsList);
});

// 2. חיבור זמן אמת - הלב של המערכת (SSE)
app.get('/stream', (req, res) => {
    // הגדרת כותרות לחיבור פתוח קבוע
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); 

    // יצירת מזהה ייחודי ללקוח והוספתו לרשימה
    const clientId = Date.now();
    clients.push({ id: clientId, res });

    // שליחת הודעת התחברות ראשונית
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // כשהמשתמש סוגר את התוסף - נמחק אותו מרשימת הלקוחות
    req.on('close', () => {
        clients = clients.filter(client => client.id !== clientId);
    });
});

// 3. בדיקת חיים - שומר על השרת ער (בשרתים חינמיים כמו Render)
app.get('/ping', (req, res) => {
    res.send('pong');
});

// ==========================================
// חלק 2: מנוע איסוף חדשות (Collector)
// ==========================================

// יצירת מזהה ייחודי למניעת כפילויות
function generateHash(text) {
    return crypto.createHash('md5').update(text).digest('hex');
}

// שידור הודעה לכל המשתמשים המחוברים מיד
function broadcast(newsItem) {
    clients.forEach(client => {
        client.res.write(`data: ${JSON.stringify({ type: 'news', data: newsItem })}\n\n`);
    });
}

// פונקציית הסריקה ההדרגתית (כל פעם מקור אחד)
async function fetchNews() {
    if (sources.length === 0) return;

    const url = sources[currentSourceIndex];
    try {
        const feed = await parser.parseURL(url);

        // עוברים מהישן לחדש כדי שהחדש ביותר יכנס אחרון וישאר למעלה
        feed.items.reverse().forEach(item => { 
            const hash = generateHash(item.title + (item.contentSnippet || ''));

            // בדיקה אם הידיעה כבר במערכת
            const exists = newsList.find(n => n.hash === hash);

            if (!exists) {
                const newsItem = {
                    hash,
                    title: item.title,
                    link: item.link,
                    source: feed.title || 'חדשות',
                    time: new Date().toISOString()
                };

                // הוספה לראש הרשימה
                newsList.unshift(newsItem);

                // ניקוי זיכרון - שמירה רק על 200 ידיעות
                if (newsList.length > MAX_NEWS) {
                    newsList.pop();
                }

                // שידור הידיעה החדשה בזמן אמת לכלל המשתמשים
                broadcast(newsItem);
            }
        });
    } catch (error) {
        console.error(`שגיאה במשיכת נתונים מ- ${url}:`, error.message);
    }

    // מעבר למקור הבא בסבב כדי לא להעמיס על אתר אחד
    currentSourceIndex = (currentSourceIndex + 1) % sources.length;
}

// הפעלת הסריקה כל 10 שניות (כפי שאופיין)
setInterval(fetchNews, 10000);
fetchNews(); // הפעלה ראשונה מיד עם עליית השרת

// ==========================================
// הפעלת השרת
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`השרת פועל בהצלחה על פורט ${PORT}`);
});