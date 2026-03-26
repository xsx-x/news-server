
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Parser = require('rss-parser');
const cheerio = require('cheerio'); 

const app = express();
app.use(cors());

// הוספת פסק זמן (Timeout) למנוע ה-RSS כדי שלא ייתקע לנצח
const parser = new Parser({
    timeout: 8000
});

let newsList = []; 
let clients = []; 
const MAX_NEWS = 1000; 

// רשימת הערוצים
const channels = [
    { name: "JDN (אתר)", url: "https://www.jdn.co.il/feed/", type: "rss" },
    { name: "ערוץ 7 (אתר)", url: "https://www.inn.co.il/Rss.aspx?Category=1", type: "rss" },
    { name: "סרוגים (אתר)", url: "https://www.srugim.co.il/feed", type: "rss" },
    { name: "המחדש (אתר)", url: "https://hm-news.co.il/feed/", type: "rss" },
    { name: "דובר צהל", url: "https://t.me/s/idfofficial", type: "telegram" },
    { name: "פיקוד העורף", url: "https://t.me/s/PikudHaOref_Official", type: "telegram" },
    { name: "זק״א", url: "https://t.me/s/zaka_il", type: "telegram" },
    { name: "איחוד הצלה", url: "https://t.me/s/ichudhatzala", type: "telegram" },
    { name: "מגן דוד אדום", url: "https://t.me/s/mda_israel", type: "telegram" },
    { name: "הלכה יומית", url: "https://t.me/s/halacha_yomit", type: "telegram" },
    { name: "ערוץ 14 (אתר)", url: "https://www.now14.co.il/feed/", type: "rss" },
    { name: "עמית סגל", url: "https://t.me/s/amitsegal", type: "telegram" },
    { name: "ינון מגל", url: "https://t.me/s/yinonews", type: "telegram" },
    { name: "יאיר שרקי", url: "https://t.me/s/yaircherki", type: "telegram" },
    { name: "ברק רביד", url: "https://t.me/s/barakravid", type: "telegram" },
    { name: "ניר דבורי", url: "https://t.me/s/nir_dvori", type: "telegram" },
    { name: "אלמוג בוקר", url: "https://t.me/s/almogboker", type: "telegram" },
    { name: "סיון רהב מאיר", url: "https://t.me/s/SivanRahavMeir", type: "telegram" },
    { name: "301 העולם הערבי", url: "https://t.me/s/arabworld301", type: "telegram" },
    { name: "אבו עלי אקספרס", url: "https://t.me/s/abualiexpress", type: "telegram" },
    { name: "זירת החדשות", url: "https://t.me/s/ZiratNews", type: "telegram" },
    { name: "מבזקי בטחון 24/7", url: "https://t.me/s/MivzakeyBitachon", type: "telegram" },
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
    
    // --- ערוצים חדשים לבקשתך (מאוד פעילים) ---
    { name: "החדשות החמות", url: "https://t.me/s/thehotnews", type: "telegram" },
    { name: "חדשות גלובל", url: "https://t.me/s/global_news_israel", type: "telegram" },
    { name: "צ'אט כתבים", url: "https://t.me/s/Chat_Khatavim", type: "telegram" },
    { name: "המוקד", url: "https://t.me/s/Hamoked_il", type: "telegram" },
    { name: "ידיעות בני ברק", url: "https://t.me/s/Yedioth_Bnei_Brak", type: "telegram" },
    { name: "קומנדו ניוז", url: "https://t.me/s/commando_news", type: "telegram" },
    { name: "הסקופים", url: "https://t.me/s/scoops_news", type: "telegram" },
    { name: "מוטי קסטל", url: "https://t.me/s/moti_kastel", type: "telegram" },
    
    // --- תוספות של ערוצים עם "מבול" של עדכונים ---
    { name: "בחדרי חרדים", url: "https://t.me/s/bhol_news", type: "telegram" },
    { name: "חדשות לפני כולם", url: "https://t.me/s/News_Now_Israel", type: "telegram" },
    { name: "דניאל עמרם ללא צנזורה", url: "https://t.me/s/danielamram3", type: "telegram" },
    { name: "אדר גיציס (N12)", url: "https://t.me/s/adar_gitsis", type: "telegram" },
    { name: "הלל ביטון רוזן", url: "https://t.me/s/HallelBittonRosen", type: "telegram" },
    { name: "ישראל ללא צנזורה", url: "https://t.me/s/israel_news_no_censorship", type: "telegram" },
    { name: "עזה אקסקלוסיב", url: "https://t.me/s/Gaza_Exclusive", type: "telegram" },
    { name: "חדשות אמת", url: "https://t.me/s/emethadashot", type: "telegram" },
    { name: "חדשות הביטחון", url: "https://t.me/s/security_news_il", type: "telegram" },
    { name: "מבזקי רעם", url: "https://t.me/s/mivzakeraam", type: "telegram" },
    { name: "חדשות המל''ל (לא רשמי)", url: "https://t.me/s/News_israel_24_7", type: "telegram" },
    { name: "יוסי אליעזר - 360", url: "https://t.me/s/yosieliezer", type: "telegram" },
    
    // --- RSS נוספים של אתרים גדולים ---
    { name: "בחדרי חרדים (אתר)", url: "https://www.bhol.co.il/rss.aspx", type: "rss" },
    { name: "אייס (אתר)", url: "https://www.ice.co.il/rss/", type: "rss" },
    { name: "כלכליסט (אתר)", url: "https://www.calcalist.co.il/GeneralRSS/0,16335,L-8,00.xml", type: "rss" },
    { name: "דה מרקר (אתר)", url: "https://www.themarker.com/srv/rss/all", type: "rss" }
];

app.get('/', (req, res) => {
    res.json(newsList);
});

// צינור זמן אמת
app.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); 

    const clientId = Date.now();
    clients.push({ id: clientId, res });

    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    req.on('close', () => {
        clients = clients.filter(client => client.id !== clientId);
    });
});

app.get('/ping', (req, res) => {
    res.send('pong');
});

// === מנגנון Heartbeat למניעת ניתוקים ב-Render ===
setInterval(() => {
    clients.forEach(c => {
        // שולח הערה ריקה ששומרת על החיבור פתוח אבל לא מקפיצה הודעה בדפדפן
        c.res.write(':\n\n');
    });
}, 25000);

function generateHash(text) {
    return crypto.createHash('md5').update(text).digest('hex');
}

function broadcast(newsItem) {
    clients.forEach(client => {
        client.res.write(`data: ${JSON.stringify({ type: 'news', data: newsItem })}\n\n`);
    });
}

async function fetchChannelData(channel) {
    let itemsToProcess = [];

    // עטיפת הגישה לרשת ב-Try/Catch כדי שאף אתר לא יפיל את השרת
    try {
        if (channel.type === 'rss') {
            const feed = await parser.parseURL(channel.url);
            itemsToProcess = feed.items.map(item => {
                const rawContent = item.content || item.contentSnippet || '';
                let cleanText = cheerio.load(rawContent).text();
                cleanText = cleanText.replace(/<[^>]+>/g, '').trim();

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
                    imageUrl: imageUrl,
                    time: item.isoDate || new Date().toISOString()
                };
            });
        } else if (channel.type === 'telegram') {
            // הוספת פסק זמן למשיכת נתונים מטלגרם
            const response = await fetch(channel.url, { signal: AbortSignal.timeout(8000) });
            const html = await response.text();
            const $ = cheerio.load(html);

            $('.tgme_widget_message').each((i, el) => {
                const textEl = $(el).find('.tgme_widget_message_text');
                if (!textEl.length) return;

                let fullText = textEl.text().trim();
                fullText = fullText.replace(/\d+\s*תגובות/g, '').replace(/תגובה\s*אחת/g, '').replace(/\n+$/, '').trim();

                let lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                let title = lines.length > 0 ? lines[0] : '';
                let content = lines.length > 1 ? lines.slice(1).join('\n') : '';

                if (title.length > 100) {
                    content = title.substring(100) + (content ? '\n' + content : '');
                    title = title.substring(0, 100) + '...';
                }

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
    } catch (error) {
        console.error(`שגיאה במשיכת נתונים מ- ${channel.name}:`, error.message);
        return; // יציאה בטוחה מהפונקציה למקרה של שגיאה מבלי להפיל את הלולאה
    }

    itemsToProcess.reverse().forEach(item => { 
        const hash = generateHash(item.title + item.content);
        const exists = newsList.find(n => n.hash === hash);
        
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

// לולאה חכמה - כל דקה מסיימת סבב (מניעת חסימות)
async function fetchAllChannels() {
    console.log("מתחיל סבב סריקת ערוצים...");

    for (let i = 0; i < channels.length; i++) {
        const channel = channels[i];
        if (!channel.url || channel.url.trim() === '') continue;

        // קריאה לפונקציה (שכבר מכילה הגנת Try/Catch בתוכה)
        await fetchChannelData(channel);
        
        // השהייה למניעת חסימות
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    console.log("סבב הסריקה הסתיים בהצלחה.");
}

const FETCH_INTERVAL = 60 * 1000; 
setInterval(fetchAllChannels, FETCH_INTERVAL);
fetchAllChannels();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`השרת פועל בהצלחה על פורט ${PORT}`);
});
