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

מ-Milestone 5: גם Supabase Auth. הספרייה של Supabase בדפדפן (auth.js) משמשת רק לכניסה: הרשמה, כניסה, התנתקות ושמירת הטוקן. הכתובת והמפתח הציבורי מגיעים מ-/api/config. הדף לא קורא ולא כותב אף טבלה.
מ-Milestone 6: טבלת votes, והפונקציות cast_vote ו-joke_feed. "צחקתי" מוחלף ב"אהבתי" ו"לא אהבתי".

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

### שינויים במבנה הנתונים (Milestones 5 ו-6)
**Milestone 5**, migration add_joke_authors, וקובץ db/add_joke_authors.sql. בטבלה jokes שתי עמודות חדשות, לא חובה (אורח לא מחובר):

| העמודה | הסוג | הערה |
|---|---|---|
| user_id | uuid | references auth.users (id) on delete set null. אינדקס |
| author_name | text | null, או 1 עד 30 תווים אחרי btrim |

**Milestone 6**, migration create_votes, וקובץ db/create_votes.sql. טבלה public.votes:

| העמודה | הסוג | הערה |
|---|---|---|
| user_id | uuid | חובה, references auth.users (id) on delete cascade |
| joke_id | uuid | חובה, references public.jokes (id) on delete cascade. אינדקס |
| value | smallint | חובה, 1 או 1- |
| voted_at | timestamptz | חובה, now() |

- המפתח הראשי: (user_id, joke_id). זה מבטיח קול אחד לכל משתמש לכל בדיחה.
- הנעילה: RLS דולק בלי policy, revoke all מ-anon ומ-authenticated, ו-grant select, insert, update, delete ל-service_role.
- public.cast_vote(voter uuid, target uuid, new_value smallint), ב-plpgsql: 1 או 1- מוסיפה או מעדכנת (on conflict do update), 0 מוחקת, כל ערך אחר שגיאה. מחזירה likes, dislikes ו-my_vote.
- public.joke_feed(viewer uuid, mode text, max_rows integer default 20), ב-sql, stable. מצבים: new לפי created_at, top רק עם like אחד לפחות לפי likes פחות dislikes ואז likes, liked רק מה ש-viewer סימן 1 לפי voted_at. viewer הוא null לאורח. max_rows בין 1 ל-50.
- בשתי הפונקציות: security invoker, ‏set search_path = '', שמות מלאים, revoke execute מ-public, anon ו-authenticated, ו-grant execute ל-service_role.
- העמודה laughs והפונקציה add_laugh נשארות בבסיס הנתונים, והאפליקציה מפסיקה להשתמש בהן.

החוזה בין הדף לפונקציות, אחרי Milestone 6:

| הפונקציה | בקשה | טוקן | תשובה |
|---|---|---|---|
| /api/config | GET | לא | { url, publishableKey } |
| /api/joke | POST { topic } | רשות | { joke, id, author_name } |
| /api/feed?mode=new או top | GET | רשות | { jokes: [{ id, topic, text, author_name, likes, dislikes, my_vote, created_at }] } |
| /api/feed?mode=liked | GET | חובה | כמו למעלה |
| /api/vote | POST { id, value } | חובה | { likes, dislikes, my_vote } |
| /api/delete-account | POST | חובה | { deleted: true } |

- שגיאה: { error: "הודעה קצרה בעברית" }. כשצריך להתחבר: 401 עם { error, code: "auth_required" }.
- כל התשובות עם Cache-Control: no-store, כי הן תלויות במי ששואל.
- /api/vote: value הוא 1, 1- או 0 בדיוק, כמספר, ו-id חייב להיות uuid. user_id בגוף לא נחשב. בדיחה שלא קיימת: 404. value לא חוקי: 400.
- /api/feed: 20 שורות ב-new, 10 ב-top, 50 ב-liked. אף פעם לא מחזירה user_id.
- /api/delete-account: מנקה את author_name בבדיחות של המשתמש, ואז supabase.auth.admin.deleteUser. הבדיחות נשארות, בלי שם ובלי בעלים. ההצבעות נמחקות (cascade).
- api/laugh.js ו-api/top.js נמחקים ב-Milestone 6. feed.js מחליפה את top.js.

## 3. התחברות והרשאות
**עד Milestone 4:** אין כניסה, רמה 0. כל גולש יכול לבקש בדיחה. ההגנה על העלות היא אורך נושא מוגבל, ומגבלת הוצאה בחשבון OpenAI.

**מ-Milestone 5: רמה 3 לפי course-stack.md.** משתמשים אמיתיים עם הרשמה עצמית, ב-Supabase Auth, עם מייל וסיסמה (Confirm email כבוי). כניסה עם Google היא בונוס, אחרי Milestone 6.
- אורח ממשיך לבקש בדיחות ולקרוא את הקהילה. כדי לדרג או לראות "אהבתי" צריך חשבון.
- הדף שולח את הטוקן בכותרת Authorization.
- כל פונקציה שצריכה לדעת מי שואל מזהה אותו רק עם supabase.auth.getUser(token). מזהה משתמש או שם שמגיעים מהדף, לא נחשבים.
- lib/supabase.js: הלקוח היחיד עם המפתח הסודי, ובנוסף hasToken(request), getUserFromRequest(request, supabase) ו-displayName(user) (user_metadata.full_name, עד 30 תווים). getUserFromRequest מחזירה את המשתמש או null, וזורקת שגיאה כש-Supabase לא זמין.
- api/joke.js: טוקן ש-Supabase לא מכיר: 401 עם auth_required, בלי לפנות ל-OpenAI. Supabase לא זמין: הבדיחה בכל זאת מגיעה, בלי שמירה.
- auth.js בשורש: ready, signUp(name, email, password) עם full_name ב-user_metadata, signIn, signOut ב-scope מקומי, session, token, onChange, והודעות שגיאה בעברית. flowType של pkce.
- הדף: כשנשלח טוקן וחוזר 401 עם auth_required, מתנתק לבד וכותב "צריך להתחבר שוב".
- בדשבורד של Supabase, ביד: Allow new users to sign up דולק, Confirm email כבוי. ב-URL Configuration: ‏Site URL הכתובת ב-Vercel, וב-Redirect URLs אותה כתובת עם /** (ולמי שמריץ מקומית גם http://localhost:3000/**).

**בונוס, כניסה עם Google:** כפתור "המשך עם Google" בחלון הכניסה, אותו טוקן ואותן פונקציות. בשרת לא משתנה כלום. auth.js מוסיף google() עם signInWithOAuth, ובודק קודם ב-/auth/v1/settings שהספק דולק. הלשונית, הבדיחה וההצבעה שחיכתה נשמרים ב-sessionStorage ומשוחזרים בחזרה. ה-Client Secret נשאר רק בדשבורד של Supabase.

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
| SUPABASE_PUBLISHABLE_KEY | Vercel, כל הסביבות | Config | המפתח הציבורי, לא סוד. רק api/config.js מחזירה אותו לדף. אם הוא מפתח סודי: 500 עם auth_not_configured. מ-Milestone 5 |
| Client Secret של Google | רק בדשבורד של Supabase, בספק Google | לא בקוד ולא ב-Vercel | בונוס |

- המפתח לא מופיע בשום קובץ שנכנס לריפו, ולא בצ׳אט עם Claude. היחיד: .env.local במחשב, למי שמריץ מקומית.
- מפתח ה-production נשמר ב-Vercel כבר ב-Milestone 1. אחרי כל שינוי במשתנה: Redeploy.
- .claude/settings.json חוסם ל-Claude את הקריאה של .env ושל .env.*. בריפו יש .env.example עם השורות OPENAI_API_KEY= ו-SUPABASE_SECRET_KEY= בלבד. גם .env.local מכיל רק את השורה הזו, עם מפתח ה-dev. שם המודל לא נכנס לקובץ: בלי OPENAI_MODEL הקוד משתמש ב-gpt-5.
- .env.example לא משתנה: OPENAI_API_KEY= ו-SUPABASE_SECRET_KEY= בלבד. המפתח הציבורי אינו סוד, ולכן הוא לא בקובץ.
- הדפדפן לא מקבל אף מפתח סודי. הוא פונה רק ל-/api. מ-Milestone 5 הוא מקבל מ-/api/config את כתובת הפרויקט ואת המפתח הציבורי, ופונה עם הספרייה של Supabase רק לנתיב /auth/v1 (בלי /rest/v1).
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
auth.js                 כל הכניסה בדפדפן (מ-Milestone 5)
api/config.js           הכתובת והמפתח הציבורי (מ-Milestone 5)
api/joke.js             הבדיחה מ-OpenAI, ושמירה בטבלה, עם השם של המחובר
api/delete-account.js   מחיקת חשבון (מ-Milestone 5)
api/vote.js             "אהבתי" ו"לא אהבתי", דרך cast_vote (מ-Milestone 6)
api/feed.js             קהילה ו"אהבתי", דרך joke_feed (מ-Milestone 6)
api/laugh.js, api/top.js  Milestone 4 בלבד. נמחקים ב-Milestone 6
lib/supabase.js         הלקוח של Supabase, עם המפתח הסודי, ועזרי הזיהוי. מחוץ ל-api, ולכן בלי כתובת
lib/http.js             תשובת JSON עם no-store, תשובת 401 עם auth_required, וקריאת גוף עם מגבלת גודל
db/create_jokes.sql     העתק של ה-migration
db/add_joke_authors.sql, db/create_votes.sql   ה-migrations של Milestones 5 ו-6
spec/                   מסמכי האיפיון, ו-spec/plans
```

ה-service worker:
- באירוע install שומר במטמון את /, את /auth.js (מ-Milestone 5), את ה-manifest, את קבצי ה-SVG מתיקיית assets ואת שני האייקונים. בכל Milestone חדש: גרסת מטמון חדשה.
- בכל בקשת GET מאותה כתובת: קודם רשת, ושומר עותק. אין רשת: מחזיר מהמטמון.
- בקשה ל-/api, בקשה שאינה GET, או בקשה לכתובת אחרת: לא נוגע בה.

## הנחות והחלטות
- בלי ai-tests.md. במקומו, חמש בדיקות ידניות בתנאי ההשלמה של Milestone 2. המוצר קטן, והפלט הוא טקסט חופשי.
- שני גופנים מ-Google Fonts, Fredoka ו-Playpen Sans Hebrew, עם גיבוי ל-system-ui. ה-service worker לא שומר אותם, כי הם מכתובת אחרת.
- CSS ו-JavaScript בתוך index.html, כי יש מסך אחד.
- `reasoning: { effort: "low" }` כדי שהבדיחה תחזור מהר. אם התיעוד העדכני לא תומך בשדה הזה במודל שנבחר, מורידים אותו.
- הפונקציה כותבת console.log קצר לכל בדיחה (הנושא והמודל), כדי לראות פניות ב-Logs.
