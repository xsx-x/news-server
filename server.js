const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Parser = require('rss-parser');
const cheerio = require('cheerio'); 
const Pusher = require('pusher'); // הוספנו את המערכת העולמית

const app = express();
app.use(cors());

const parser = new Parser();
let newsList = []; 
const MAX_NEWS = 1000; 

// חיבור לשרתי השידור העולמיים של Pusher (הכנס את הנתונים שלך מכאן!)
const pusher = new Pusher({
  app_id = "2132742"
key = "317621c007c6e7988c70"
secret = "3596169ab7ac3803c86d"
cluster = "ap2"
  useTLS: true
});

// --- רשימת הערוצים שלך נשארת כאן בדיוק אותו דבר ---
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

// נקודת הקצה למשיכת ההיסטוריה כשפותחים את הדפדפן
app.get('/', (req, res) => {
    res.json(newsList);
});
// מחקנו את ה-app.get('/stream') כי עכשיו Pusher מנהל את הלקוחות!
function generateHash(text) {
    return crypto.createHash('md5').update(text).digest('hex');
}
// הפונקציה ששולחת את המידע החוצה (עכשיו היא שולחת ל-Pusher במקום ללקוחות)
function broadcast(newsItem) {
    // השרת אומר ל-Pusher: "קח את הידיעה ופזר אותה לכולם בערוץ news-channel"
    pusher.trigger("news-channel", "new-alert", newsItem)
      .catch(err => console.error("שגיאה בשידור ל-Pusher:", err));
}

function broadcast(newsItem) {
    clients.forEach(client => {
        client.res.write(`data: ${JSON.stringify({ type: 'news', data: newsItem })}\n\n`);
    });
}

// פונקציית העזר - מושכת נתונים מערוץ בודד
async function fetchChannelData(channel) {
    let itemsToProcess = [];

    if (channel.type === 'rss') {
        const feed = await parser.parseURL(channel.url);
        itemsToProcess = feed.items.map(item => {
            const rawContent = item.content || item.contentSnippet || '';
            
            // ניקוי יסודי של תגיות HTML קורחות (כמו <p> בערוץ 7)
            let cleanText = cheerio.load(rawContent).text();
            cleanText = cleanText.replace(/<[^>]+>/g, '').trim();

            // חיפוש תמונה ב-RSS
            let imageUrl = item.enclosure ? item.enclosure.url : null;
            if (!imageUrl) {
                const imgMatch = rawContent.match(/<img[^>]+src="([^">]+)"/i);
                if (imgMatch) imageUrl = imgMatch[1];
            }
            
            return {
                title: item.title,
                content: cleanText, 
                link: item.link,
                source: channel.name,
                imageUrl: imageUrl, // הוספנו תמונה
                time: item.isoDate || new Date().toISOString()
            };
        });
    } else if (channel.type === 'telegram') {
        const response = await fetch(channel.url);
        const html = await response.text();
        const $ = cheerio.load(html);

        $('.tgme_widget_message').each((i, el) => {
            const textEl = $(el).find('.tgme_widget_message_text');
            if (!textEl.length) return;

            let fullText = textEl.text().trim();
            
            // הסרת כיתובי התגובות מהסוף
            fullText = fullText.replace(/\d+\s*תגובות/g, '').replace(/תגובה\s*אחת/g, '').replace(/\n+$/, '').trim();

            // חלוקה חכמה לכותרת ותוכן כדי למנוע כפילויות
            let lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            let title = lines.length > 0 ? lines[0] : '';
            let content = lines.length > 1 ? lines.slice(1).join('\n') : '';

            // חיתוך כותרות ארוכות מדי
            if (title.length > 100) {
                content = title.substring(100) + (content ? '\n' + content : '');
                title = title.substring(0, 100) + '...';
            }

            // שליפת תמונה מטלגרם (אם יש)
            let imageUrl = null;
            const styleWrap = $(el).find('.tgme_widget_message_photo_wrap').attr('style');
            if (styleWrap) {
                const match = styleWrap.match(/background-image:url\('([^']+)'\)/);
                if (match) imageUrl = match[1];
            }
            
            const timeStr = $(el).find('time').attr('datetime');
            const link = $(el).find('.tgme_widget_message_date').attr('href') || channel.url;

            itemsToProcess.push({
                title: title,
                content: content, 
                link: link,
                source: channel.name,
                imageUrl: imageUrl, 
                time: timeStr ? new Date(timeStr).toISOString() : new Date().toISOString()
            });
        });
    }

    // מיון, סינון ושמירה בזיכרון השרת
    itemsToProcess.reverse().forEach(item => { 
        const hash = generateHash(item.title + item.content);
        const exists = newsList.find(n => n.hash === hash);
        
        // הגדלנו את טווח הזמן ל-48 שעות כדי שהתוסף יתמלא!
        const isTooOld = new Date(item.time).getTime() < (Date.now() - 48 * 60 * 60 * 1000);

        if (!exists && !isTooOld) {
            const newsItem = {
                hash,
                title: item.title,
                content: item.content, 
                link: item.link,
                source: item.source,
                imageUrl: item.imageUrl, 
                time: item.time
            };

            newsList.push(newsItem);
            broadcast(newsItem);
        }
    });

    newsList.sort((a, b) => new Date(b.time) - new Date(a.time));

    if (newsList.length > MAX_NEWS) {
        newsList = newsList.slice(0, MAX_NEWS);
    }
}

// הפונקציה הראשית והחכמה - סורקת את הכל אחת לדקה
async function fetchAllChannels() {
    console.log("מתחיל סבב סריקת ערוצים...");

    for (let i = 0; i < channels.length; i++) {
        const channel = channels[i];
        
        // דילוג על ערוצים עם כתובת ריקה
        if (!channel.url || channel.url.trim() === '') continue;

        try {
            await fetchChannelData(channel);
        } catch (error) {
            console.error(`שגיאה במשיכת נתונים מ- ${channel.name}:`, error.message);
        }

        // --- קסם מניעת החסימות ---
        // השרת ממתין חצי שנייה (500ms) לפני שהוא עובר לאתר הבא
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log("סבב הסריקה הסתיים. נמשכו 1000 הודעות (מקסימום)");
}

// הגדרת זמן ההמתנה בין סבב לסבב - 60 שניות
const FETCH_INTERVAL = 60 * 1000; 

// הפעלת הלולאה המחזורית לנצח (כל 60 שניות)
setInterval(fetchAllChannels, FETCH_INTERVAL);

// הפעלה ראשונית מיד כשהשרת עולה
fetchAllChannels();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`השרת פועל בהצלחה על פורט ${PORT}`);
});
