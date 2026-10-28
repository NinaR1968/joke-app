# Milestone 1: Walking Skeleton — תכנית

## מטרה
הדף והפונקציה באוויר ב-Vercel, באותה כתובת, ומדברים זה עם זה. עוד בלי AI.

## החלטות (סוכמו)
- בדיקה: בכתובת של Vercel בלבד. בלי `vercel dev` ובלי מפתח dev בשלב זה.
- מבנה הקבצים בדיוק לפי סעיף 7 ב-ARCHITECTURE.md: `index.html` אחד עם CSS ו-JS בפנים, `api/joke.js`, `package.json`.

## שלב 1: תכנון (הקובץ הזה)

## שלב 2: בנייה
1. בדיקת הגנות מההקמה: `.gitignore`, `.env.example`, `.claude/settings.json` (קיימים; נבדקו בלי לקרוא ערכים).
2. `package.json`: `"type": "module"`, בלי dependencies.
3. `api/joke.js`: `export default { async fetch(request) {...} }`.
   - לא POST: 405 עם `{ "error": "..." }`.
   - POST: קוראת `topic` מה-JSON (גוף שבור = ריק), חותכת ל-100 תווים.
   - מחזירה `{ "joke": "בדיחה זמנית מהשרת: [הנושא]. המפתח: נמצא" }`, או "המפתח: חסר" כש-`process.env.OPENAI_API_KEY` ריק. רק כן/לא, אף פעם לא המפתח.
   - `console.log` קצר לכל בקשה (בשביל Logs ב-Vercel).
   - בלי CORS ובלי OPTIONS.
4. `index.html`: `lang="he"`, `dir="rtl"`, המסך הראשי לפי DESIGN.md (לוגו 300, הסבר, תווית, תיבה maxlength 100, כפתור, בועה עם הדמות, תחתית), צבעים, גופנים (Fredoka, Playpen Sans Hebrew), צללים קשים, רקע bg-dots + bg-doodles.
   - ארבעת המצבים דרך `data-state` (idle/think/joke/error) והתנועות, כולל `prefers-reduced-motion`. ב-Milestone 1 הלחיצה מפעילה טעינה, ואז בדיחה או שגיאה.
   - שליחה: `fetch("/api/joke", POST)`, והצגה עם `textContent`.
5. בלי manifest ובלי sw.js (Milestone 3).

## שלב 3: הרצה (ביד, ב-Vercel)
1. push ל-main.
2. Vercel: New Project, Import לריפו `NinaR1968/joke-app`, Framework Preset: Other, Deploy.
3. OpenAI, API keys: מפתח `joke-in-a-click`.
4. Vercel, Environment Variables: `OPENAI_API_KEY`, סוג Secret, Production ו-Preview. אחר כך Redeploy.

## שלב 4: דחיפה וקבלת לינק
push ל-main, ולינק חי ב-Vercel.

## תנאי השלמה
1. נפתח בטלפון, עברית, RTL, עיצוב DESIGN.md.
2. לחיצה מציגה "בדיחה זמנית מהשרת" עם הנושא ו"המפתח: נמצא".
3. Network: POST אחד ל-/api/joke, באותה כתובת.
4. ב-Logs של Vercel שורה לכל לחיצה.
5. אין CORS ואין OPTIONS.
6. בריפו אין .env/.env.local; יש .env.example עם `OPENAI_API_KEY=` ו-.claude/settings.json.

## סטטוס
נבנה: package.json, api/joke.js, index.html. api/joke.js נבדקה מקומית ב-node (POST, GET=405, גוף שבור). ממתין ל-push, פריסה ב-Vercel ובדיקה ידנית.
