# ARCHITECTURE: בדיחה בלחיצה

## 1. מבנה המערכת בשלוש שכבות

### צד לקוח
- index.html אחד, עם ה-CSS וה-JavaScript בתוכו. עברית, `lang="he"` ו-`dir="rtl"`.
- הלוגו, ארבעת הציורים של הדמות והרקע הם קבצי SVG בתיקיית assets. הדף מחליף ביניהם לפי `data-state` על הבועה: idle, think, joke, error.
- טופס עם תיבה (maxlength 100) וכפתור. בשליחה: POST ל-/api/joke, ואז הצגת הבדיחה או ההודעה.
- הטקסט שחוזר מוצג עם textContent, לא innerHTML.
- רושם את sw.js כ-service worker.

### לוגיקה
- הפונקציות בתיקייה api. הראשונה, api/joke.js, עם `export default { async fetch(request) { ... } }`.
- מקבלת רק POST עם JSON: `{ "topic": "..." }`. מחזירה תמיד JSON: `{ "joke": "..." }` בהצלחה, `{ "error": "..." }` בשגיאה.
- חותכת את הנושא ל-100 תווים. נושא ריק או גוף שבור נחשבים "אין נושא".
- פונה ל-OpenAI, מחלצת את הטקסט, ומחזירה רק את הבדיחה.

### נתונים
מ-Milestone 4: Supabase. טבלה אחת, jokes, ופונקציה אחת בבסיס הנתונים, add_laugh. רק הפונקציות בתיקייה api מדברות עם Supabase, עם המפתח הסודי. הדף מדבר רק עם /api.

## 2. מבנה הנתונים
מ-Milestone 4, טבלה אחת ב-Supabase:

| העמודה | הסוג | הערה |
|---|---|---|
| id | uuid | מפתח ראשי, gen_random_uuid() |
| created_at | timestamptz | now() |
| topic | text | הנושא, או null |
| text | text | הבדיחה. חובה |
| laughs | integer | מונה הצחוקים. חובה, 0 |

- הנעילה: RLS דולק בלי policy. grant select, insert, update ל-service_role בלבד. revoke all מ-anon ומ-authenticated.
- public.add_laugh(joke_id uuid) מוסיפה 1 ומחזירה את המספר החדש, בצעד אחד, כדי ששתי לחיצות באותו רגע ייספרו. execute ל-service_role בלבד.
- ה-SQL שמור ב-db/create_jokes.sql, ורץ דרך המחבר של Supabase.

החוזה בין הדף לפונקציה:

| כיוון | הגוף | סטטוס |
|---|---|---|
| הדף אל הפונקציה | `{ "topic": "חתולים" }`, או `{ "topic": "" }` | POST |
| הפונקציה אל הדף, הצלחה | `{ "joke": "...", "id": "uuid" }`. id הוא null אם השמירה נכשלה | 200 |
| /api/laugh | POST `{ "id": "uuid" }`, ומחזירה `{ "laughs": 3 }` | 200, 400 או 404 |
| /api/top | GET, ומחזירה `{ "jokes": [{ "id", "topic", "text", "laughs" }] }` | 200 |
| הפונקציה אל הדף, שגיאה | `{ "error": "הודעה קצרה בעברית" }` | 405, 500 או 502 |

## 3. התחברות והרשאות
אין כניסה, רמה 0. כל גולש יכול לבקש בדיחה. ההגנה על העלות היא אורך נושא מוגבל, ומגבלת הוצאה בחשבון OpenAI.

## 4. שכבת ה-AI
- הקריאה: POST אל `https://api.openai.com/v1/responses`, מתוך הפונקציה בלבד, עם הכותרת `Authorization: Bearer <OPENAI_API_KEY>`.
- הגוף: `model` מ-OPENAI_MODEL או `gpt-5`, ‏`instructions` עם הפרומפט המרכזי, `input` עם הנושא, ‏`reasoning: { effort: "low" }` ו-`max_output_tokens`.
- הפרומפט המרכזי: "אתה כותב בדיחות קצרות בעברית. כתוב בדיחה אחת בלבד, עד ארבעה משפטים, נקייה ומתאימה לכל גיל. בלי הקדמה, בלי הסבר ובלי אימוג׳י. רק הבדיחה."
- ה-input: "נושא הבדיחה: [הנושא]". בלי נושא: "אין נושא. ספר בדיחה כללית על החיים."
- התשובה: לוקחים את `output_text` אם קיים. אחרת, את הטקסט מהפריטים מסוג `message` במערך `output`, בחלקים מסוג `output_text`. אין טקסט: שגיאה.
- שגיאה מ-OpenAI: הסטטוס והקוד נרשמים ב-console.error, והדף מקבל הודעה קצרה בעברית לפי הקוד: 401, נגמר הקרדיט, מגבלת הוצאה, 429, 404.
- לפני כתיבת הקוד בודקים בתיעוד העדכני של OpenAI ושל Vercel את מבנה הבקשה והתשובה.

## 5. אינטגרציות, APIs ואוטומציות
- OpenAI Responses API בלבד, מהפונקציה.
- אין אוטומציות ואין שירותים נוספים.

## 6. מפתחות וסודות
| השם | איפה | סוג | מה הוא |
|---|---|---|---|
| OPENAI_API_KEY | Vercel, Environment Variables, ב-Production וב-Preview | Secret | מפתח ה-production, ‏joke-in-a-click. רק הפונקציה קוראת אותו |
| OPENAI_API_KEY | .env.local במחשב, רק בהרצה מקומית | קובץ שלא נכנס לריפו | מפתח dev נפרד, ‏joke-in-a-click-dev. הסטודנט מדביק אותו ביד |
| OPENAI_MODEL | Vercel, Environment Variables | Config, לא חובה | שם המודל. בלי המשתנה: gpt-5 |
| SUPABASE_URL | Vercel, כל הסביבות | Config | כתובת הפרויקט ב-Supabase. מ-Milestone 4 |
| SUPABASE_SECRET_KEY | Vercel, Production ו-Preview | Secret | המפתח הסודי, שעוקף את הנעילה. רק lib/supabase.js קורא אותו. מ-Milestone 4 |

- המפתח לא מופיע בשום קובץ שנכנס לריפו, ולא בצ׳אט עם Claude. היחיד: .env.local במחשב, למי שמריץ מקומית.
- מפתח ה-production נשמר ב-Vercel כבר ב-Milestone 1. אחרי כל שינוי במשתנה: Redeploy.
- .claude/settings.json חוסם ל-Claude את הקריאה של .env ושל .env.*. בריפו יש .env.example עם השורות OPENAI_API_KEY= ו-SUPABASE_SECRET_KEY= בלבד. גם .env.local מכיל רק את השורה הזו, עם מפתח ה-dev. שם המודל לא נכנס לקובץ: בלי OPENAI_MODEL הקוד משתמש ב-gpt-5.
- הדפדפן לא מקבל אף מפתח. הוא פונה רק ל-/api/joke.
- .gitignore כולל `.env`, ‏`.env.*`, את החריגה `!.env.example`, ‏`.vercel` ו-`node_modules`. הוא נוצר לפני הקומיט הראשון.
- בחשבון OpenAI: קרדיט מראש, Auto recharge כבוי, ומגבלת הוצאה חודשית.

## 7. מבנה התיקיות של הקוד
```
index.html              המסך, עם ה-CSS וה-JavaScript
manifest.webmanifest    name, short_name, start_url, display: standalone, lang: he, dir: rtl, אייקונים
sw.js                   service worker, network-first, בלי /api
package.json            "type": "module", ו-@supabase/supabase-js ב-dependencies
.gitignore              .env, .env.*, !.env.example, .vercel, node_modules
.env.example            שורה אחת בלבד: OPENAI_API_KEY=, בלי ערך ובלי הערות
.claude/settings.json   חוסם ל-Claude את הקריאה של .env ושל .env.*
assets/logo.svg
assets/mascot-idle.svg, mascot-think.svg, mascot-joke.svg, mascot-error.svg
assets/bg-dots.svg, bg-doodles.svg
assets/icon.svg, icon-maskable.svg
assets/icon-192.png, icon-512.png, icon-512-maskable.png
api/joke.js             הבדיחה מ-OpenAI, ושמירה בטבלה
api/laugh.js            "צחקתי", דרך add_laugh
api/top.js              "הכי מצחיקות"
lib/supabase.js         הלקוח של Supabase, עם המפתח הסודי. מחוץ ל-api, ולכן בלי כתובת
db/create_jokes.sql     העתק של ה-migration
spec/                   מסמכי האיפיון, ו-spec/plans
```

ה-service worker:
- באירוע install שומר במטמון את /, את ה-manifest, את קבצי ה-SVG מתיקיית assets ואת שני האייקונים.
- בכל בקשת GET מאותה כתובת: קודם רשת, ושומר עותק. אין רשת: מחזיר מהמטמון.
- בקשה ל-/api, בקשה שאינה GET, או בקשה לכתובת אחרת: לא נוגע בה.

## הנחות והחלטות
- בלי ai-tests.md. במקומו, חמש בדיקות ידניות בתנאי ההשלמה של Milestone 2. המוצר קטן, והפלט הוא טקסט חופשי.
- שני גופנים מ-Google Fonts, Fredoka ו-Playpen Sans Hebrew, עם גיבוי ל-system-ui. ה-service worker לא שומר אותם, כי הם מכתובת אחרת.
- CSS ו-JavaScript בתוך index.html, כי יש מסך אחד.
- `reasoning: { effort: "low" }` כדי שהבדיחה תחזור מהר. אם התיעוד העדכני לא תומך בשדה הזה במודל שנבחר, מורידים אותו.
- הפונקציה כותבת console.log קצר לכל בדיחה (הנושא והמודל), כדי לראות פניות ב-Logs.
