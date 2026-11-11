# בדיחה בלחיצה · joke-app

אפליקציית בדיחות לטלפון: כותבים נושא, GPT-5 כותב בדיחה, והיא נשמרת ב-Supabase. תרגיל בקורס 53500. מסמכי האיפיון בתיקייה spec.

## שפה
האפליקציה בעברית, מימין לשמאל.

## איך עובדים כאן
- הנחה אותי צעד אחר צעד מהו השלב הבא, בקצרה ובבהירות. כל פעולה שאני עושה ביד בדשבורד, כתובה כצעדים ממוספרים.
- בונים Milestone אחרי Milestone, לפי spec/MILESTONES.md. לכל Milestone שיחה חדשה באותה תיקייה, וארבעה שלבים: תכנון, בנייה, הרצה לבדיקה (בכתובת של Vercel, או במחשב עם vercel dev), ודחיפה.
- אחרי תכנון או בנייה של Milestone, מתעדים אותו ב-spec/plans/milestone-N.md.
- בסוף כל Milestone עוצרים, ומחכים לבדיקה ולאישור מפורש.
- לפני שאתה שואל שאלות, קרא קודם את הקבצים.

## מפתחות
- אל תבקש ממני אף מפתח, ואל תכתוב או תקרא מפתח בשום קובץ.
- ב-Vercel: OPENAI_API_KEY ו-SUPABASE_SECRET_KEY מסוג Secret. SUPABASE_URL ו-SUPABASE_PUBLISHABLE_KEY מסוג Config (המפתח הציבורי אינו סוד, והוא לא ב-.env.example).
- ה-Client Secret של Google (בונוס) נשאר רק בדשבורד של Supabase. לא בקוד, לא בריפו ולא ב-Vercel.
- להרצה מקומית יש מפתחות dev נפרדים, שאני מדביק בעצמי ב-.env.local. אסור לך לקרוא אותו.
- .env.example מכיל רק את השורות OPENAI_API_KEY= ו-SUPABASE_SECRET_KEY=.

## בסיס הנתונים
- Supabase, רק דרך הפונקציות בתיקייה api, עם המפתח הסודי, מלקוח אחד ב-lib/supabase.js. הדף מדבר רק עם /api.
- כל פעולה ב-Supabase עוברת דרך המחבר של Supabase, במצב Manual.
- לפני כל SQL: שומרים אותו כקובץ בתיקייה db, מציגים לי, ומחכים לאישור.
- כל טבלה נעולה: RLS דולק בלי policy, revoke all מ-anon ומ-authenticated, ו-grant רק ל-service_role. לא מקבלים הצעה להוסיף grant ל-anon.
- כל פונקציה בבסיס הנתונים: revoke execute מ-public, anon ו-authenticated, ו-grant execute ל-service_role.

## כניסה והרשאות (מ-Milestone 5)
- רמה 3: משתמשים אמיתיים עם הרשמה עצמית, ב-Supabase Auth, עם מייל וסיסמה. כניסה עם Google היא בונוס.
- הספרייה של Supabase בדפדפן (auth.js) משמשת רק לכניסה: הרשמה, כניסה, התנתקות ושמירת הטוקן. הכתובת והמפתח הציבורי מגיעים מ-/api/config. הדף לא קורא ולא כותב אף טבלה.
- הדף שולח את הטוקן בכותרת Authorization.
- הפונקציות מזהות משתמש רק עם supabase.auth.getUser(token). מזהה משתמש או שם שמגיעים בגוף הבקשה או מהדף, לא נחשבים.
- טוקן ש-Supabase לא מכיר: 401 עם code: "auth_required".

## הקוד
- index.html: המסך, עם ה-CSS וה-JavaScript. auth.js: כל הכניסה בדפדפן.
- api/config.js: הכתובת והמפתח הציבורי. api/joke.js: הבדיחה מ-OpenAI ושמירה, עם השם של המחובר. api/vote.js: "אהבתי" ו"לא אהבתי". api/feed.js: קהילה והבדיחות שאהבתי. api/delete-account.js: מחיקת חשבון.
- api/laugh.js ו-api/top.js (Milestone 4) נמחקים ב-Milestone 6.
- lib/http.js: עזרים קטנים לתשובות ולקריאת גוף.
- טקסט מהשרת או מהמשתמש מוצג עם textContent, אף פעם לא innerHTML.
- בלי טעינה בטיימר. רשימה נטענת בכניסה ללשונית ואחרי פעולה.

## ריפו ופריסה
- ריפו ציבורי joke-app ב-GitHub, ענף main בלבד.
- הלינק החי ב-Vercel. כל push ל-main מתפרס לבד.
