# Milestone 2: בדיחה מ-GPT-5 — תכנית

## מטרה
הבדיחה מגיעה מ-GPT-5 דרך הפונקציה, והמפתח נשאר בשרת.

## ממצאי התיעוד (נבדקו לפני הכתיבה)
- **Vercel:** `export default { fetch(request) {...} }` בקובץ ב-`/api` נתמך כמו שהוא, עם `Request` ו-`Response` סטנדרטיים. `"type": "module"` כבר ב-package.json.
- **OpenAI Responses API:** `POST https://api.openai.com/v1/responses`, כותרת `Authorization: Bearer`. שדות: `model`, ‏`instructions`, ‏`input`, ‏`reasoning: { effort }`, ‏`max_output_tokens`.
- **התשובה הגולמית (HTTP):** אין בה `output_text`. המאפיין הזה קיים רק ב-SDK. הטקסט נשלף מהפריטים `type: "message"` במערך `output`, מהחלקים `type: "output_text"` בשדה `text`. במערך יכולים להיות גם פריטי reasoning, ולכן לא קוראים את `output[0]`. הקוד בכל זאת בודק `output_text` קודם, לפי ARCHITECTURE.md.
- **`max_output_tokens` כולל את טוקני ה-reasoning.** אם הוא נמוך מדי, התשובה חוזרת `status: "incomplete"` בלי טקסט. לכן לא נבחר ערך קטן: מציעים 2000 (בדיחה קצרה, effort נמוך), ובמקרה של `incomplete` בלי טקסט מחזירים שגיאה בעברית.
- **`reasoning.effort`:** הערכים תלויי מודל. ל-`low` יש תמיכה בתיעוד הכללי. אם OpenAI דוחה את השדה (400), מורידים אותו.

## החלטות לאישור
1. `max_output_tokens`: 2000.
2. `reasoning: { effort: "low" }` כמו ב-ARCHITECTURE.md.
3. מיפוי שגיאות לדף (הודעה קצרה בעברית, הפרטים ב-console.error):
   - 401: "יש בעיה במפתח של השרת. נסו שוב מאוחר יותר."
   - 429 / נגמר קרדיט / מגבלת הוצאה: "הבדיחות נגמרו להיום. נסו שוב מאוחר יותר."
   - 404 (מודל לא קיים): "המודל לא נמצא. בדקו את ההגדרות בשרת."
   - אחר או אין טקסט: "לא הצלחתי להביא בדיחה. נסו שוב."
   - אין `OPENAI_API_KEY`: "השרת לא מוגדר עדיין." (500)
4. timeout לקריאה ל-OpenAI: 25 שניות (`AbortSignal.timeout`), ו-`maxDuration` ב-Vercel מוגדר ב-`export const config` רק אם צריך. התחלה בלי.
5. ה-`console.log` לכל בדיחה: הנושא והמודל, בלי המפתח.

## שלב 1: תכנון (הקובץ הזה)

## שלב 2: בנייה
1. `api/joke.js`:
   - POST בלבד, אחרת 405.
   - נושא: חיתוך ל-100 תווים, ריק או גוף שבור = אין נושא.
   - `instructions` = הפרומפט המרכזי. `input` = "נושא הבדיחה: [הנושא]", או "אין נושא. ספר בדיחה כללית על החיים."
   - `model` = `process.env.OPENAI_MODEL || "gpt-5"`.
   - שליפת טקסט: `output_text` אם קיים, אחרת הפריטים מסוג message. אין טקסט = שגיאה.
   - מחזירה `{ joke }` ב-200, או `{ error }` ב-500/502.
2. `index.html`: ארבעת המצבים כבר קיימים מ-Milestone 1. מוסיפים רק הצגת `data.error` מהשרת בבועת השגיאה (במקום ההודעה הקבועה), עם textContent.
3. בלי שינוי ב-package.json.

## שלב 3: הרצה
לפי הבחירה שלך: Vercel אחרי push, או `vercel dev` בכתובת http://localhost:3000 (דורש מפתח dev ב-.env.local, מודבק ביד).

## שלב 4: דחיפה
push ל-main, ולינק חי. אין Redeploy, חוץ מבדיקה 4 שמשנה משתנה סביבה.

## תנאי השלמה
1. "חתולים" מחזיר בדיחה על חתולים.
2. תיבה ריקה: בדיחה כללית.
3. התיבה לא מקבלת יותר מ-100 תווים.
4. `OPENAI_MODEL` שגוי + Redeploy: הודעה בעברית בדף, ושורה אדומה ב-Logs. אחר כך מוחקים את המשתנה ו-Redeploy.
5. ב-Network בקשה ל-/api/joke בלבד, בלי api.openai.com.
6. חיפוש `sk-` ב-Ctrl+U לא מוצא כלום.
7. הסבר בחמש שורות על מיקום המפתחות.
8. מקומית: בדיחה אמיתית גם ב-localhost.

## סטטוס
התכנית אושרה. שלב 2 (בנייה) הושלם: `api/joke.js` פונה ל-Responses API (מודל מ-OPENAI_MODEL או gpt-5, effort low, 2000 טוקנים, timeout 25 שניות, מיפוי שגיאות בעברית), ו-`index.html` מציג את הודעת השגיאה מהשרת. נבדק בלי רשת: תחביר תקין, בלי מפתח מוחזרת הודעה בעברית, GET מחזיר 405. עוד לא נבדק מול OpenAI. הבא: דחיפה ל-main ובדיקה לפי תנאי ההשלמה.
