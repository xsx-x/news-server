const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Parser = require('rss-parser');
const cheerio = require('cheerio'); // הוספנו את הספריה לקריאת טלגרם

const app = express();
app.use(cors());

const parser = new Parser();
let newsList = []; // שומר את החדשות האחרונות בזיכרון
let clients = []; // שומר את המשתמשים המחוברים (SSE)
const MAX_NEWS = 200; // הגבלת הידיעות בזיכרון כפי שאופיין

// רשימת הערוצים החדשה הכוללת RSS וטלגרם
const channels = [
    { name: "JDN (אתר)", url: "https://www.jdn.co.il/feed/", type: "rss" },
    { name: "ערוץ 7 (אתר)", url: "https://www.inn.co.il/Rss.aspx?Category=1", type: "rss" },
    { name: "ערוץ 14 (אתר)", url: "https://www.now14.co.il/feed/", type: "rss" },
    { name: "סרוגים (אתר)", url: "https://www.srugim.co.il/feed", type: "rss" },
    { name: "המחדש (אתר)", url: "https://hm-news.co.il/feed/", type: "rss" },
    { name: "בחדרי חרדים (אתר)", url: "https://www.bhol.co.il/rss.xml", type: "rss" },
    { name: "Ynet מבזקים", url: "https://t.me/s/ynetalert", type: "telegram" },
    { name: "Ynet חדר חדשות", url: "https://t.me/s/ynetnewsroom", type: "telegram" },
    { name: "N12 מתפרצות", url: "https://t.me/s/N12breaking", type: "telegram" },
    { name: "N12 הצ'אט", url: "https://t.me/s/N12updates", type: "telegram" },
    { name: "חדשות 13", url: "https://t.me/s/news13channel", type: "telegram" },
    { name: "וואלה! חדשות", url: "https://t.me/s/walla_news", type: "telegram" },
    { name: "כאן חדשות", url: "https://t.me/s/kan_news", type: "telegram" },
    { name: "ישראל היום", url: "https://t.me/s/israelhayom", type: "telegram" },
    { name: "מעריב", url: "https://t.me/s/maarivonline", type: "telegram" },
    { name: "גלובס", url: "https://t.me/s/globesnews", type: "telegram" },
    { name: "עכשיו 14", url: "https://t.me/s/now14updates", type: "telegram" },
    { name: "כיכר השבת", url: "https://t.me/s/kikar_news", type: "telegram" },
    { name: "דובר צהל", url: "https://t.me/s/idfonline", type: "telegram" },
    { name: "פיקוד העורף", url: "https://t.me/s/pikudhaoref", type: "telegram" },
    { name: "עמית סגל", url: "https://t.me/s/amitsegal", type: "telegram" },
    { name: "ינון מגל", url: "https://t.me/s/yinonmagal", type: "telegram" },
    { name: "יאיר שרקי", url: "https://t.me/s/yaircherki", type: "telegram" },
    { name: "ברק רביד", url: "https://t.me/s/barak_ravid", type: "telegram" },
    { name: "ניר דבורי", url: "https://t.me/s/nir_dvori", type: "telegram" },
    { name: "אלמוג בוקר", url: "https://t.me/s/almog_boker", type: "telegram" },
    { name: "סיון רהב מאיר", url: "https://t.me/s/sivanrahav", type: "telegram" },
    { name: "301 העולם הערבי", url: "https://t.me/s/arabworld301", type: "telegram" },
    { name: "אבו עלי אקספרס", url: "https://t.me/s/abualiexpress", type: "telegram" },
    { name: "זירת החדשות", url: "https://t.me/s/ziratnews", type: "telegram" },
    { name: "מבזקי בטחון 24/7", url: "https://t.me/s/mivzakey_bitahon", type: "telegram" },
    { name: "זק״א", url: "https://t.me/s/ZAKA_il", type: "telegram" },
    { name: "איחוד הצלה", url: "https://t.me/s/UnitedHatzalahIL", type: "telegram" },
    { name: "מגן דוד אדום", url: "https://t.me/s/mdaisrael", type: "telegram" },
    { name: "הלכה יומית", url: "https://t.me/s/halacha_yomit", type: "telegram" }
];
let currentSourceIndex = 0;

// ==========================================
// חלק 1: נקודות קצה בשרת (API Endpoints)
// ==========================================

// שידור הודעה לכל המשתמשים המחוברים מיד
function broadcast(newsItem) {
    clients.forEach(client => {
        client.res.write(`data: ${JSON.stringify({ type: 'news', data: newsItem })}\n\n`);
    });
}

// פונקציית הסריקה ההדרגתית (כל פעם מקור אחד)
async function fetchNews() {
    if (channels.length === 0) return;

    const channel = channels[currentSourceIndex];
    try {
        let itemsToProcess = [];

        if (channel.type === 'rss') {
            const feed = await parser.parseURL(channel.url);
            itemsToProcess = feed.items.map(item => ({
                title: item.title,
                contentSnippet: item.contentSnippet || '',
                link: item.link,
                source: channel.name,
                time: item.isoDate || new Date().toISOString()
            }));
        } else if (channel.type === 'telegram') {
            // משיכת דף האינטרנט של ערוץ הטלגרם וסריקתו
            const response = await fetch(channel.url);
            const html = await response.text();
            const $ = cheerio.load(html);

            $('.tgme_widget_message').each((i, el) => {
                const textEl = $(el).find('.tgme_widget_message_text');
                if (!textEl.length) return;

                // שולפים את הטקסט ומייצרים ממנו כותרת קצרה (עד 80 תווים)
                let text = textEl.text();
                let title = text.replace(/\n/g, ' '); 
                title = title.length > 80 ? title.substring(0, 80) + '...' : title;
                
                const timeStr = $(el).find('time').attr('datetime');
                const link = $(el).find('.tgme_widget_message_date').attr('href') || channel.url;

                itemsToProcess.push({
                    title: title,
                    contentSnippet: text,
                    link: link,
                    source: channel.name,
                    time: timeStr ? new Date(timeStr).toISOString() : new Date().toISOString()
                });
            });
        }

        // עוברים מהישן לחדש כדי שהחדש ביותר יכנס אחרון וישאר למעלה
        itemsToProcess.reverse().forEach(item => { 
            const hash = generateHash(item.title + item.contentSnippet);

            // בדיקה אם הידיעה כבר במערכת
            const exists = newsList.find(n => n.hash === hash);

            if (!exists) {
                const newsItem = {
                    hash,
                    title: item.title,
                    link: item.link,
                    source: item.source, // שם הערוץ מהרשימה
                    time: item.time
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
        console.error(`שגיאה במשיכת נתונים מ- ${channel.name}:`, error.message);
    }

    // מעבר למקור הבא בסבב כדי לא להעמיס על אתר אחד
    currentSourceIndex = (currentSourceIndex + 1) % channels.length;
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
