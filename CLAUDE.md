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
- ב-Vercel: OPENAI_API_KEY ו-SUPABASE_SECRET_KEY מסוג Secret. SUPABASE_URL מסוג Config.
- להרצה מקומית יש מפתחות dev נפרדים, שאני מדביק בעצמי ב-.env.local. אסור לך לקרוא אותו.
- .env.example מכיל רק את השורות OPENAI_API_KEY= ו-SUPABASE_SECRET_KEY=.

## בסיס הנתונים
- Supabase, רק דרך הפונקציות בתיקייה api, עם המפתח הסודי, מלקוח אחד ב-lib/supabase.js. הדף מדבר רק עם /api.
- כל פעולה ב-Supabase עוברת דרך המחבר של Supabase, במצב Manual.
- לפני כל SQL: שומרים אותו כקובץ בתיקייה db, מציגים לי, ומחכים לאישור.
- כל טבלה נעולה: RLS דולק בלי policy, revoke all מ-anon ומ-authenticated, ו-grant רק ל-service_role. לא מקבלים הצעה להוסיף grant ל-anon.

## הקוד
- index.html: המסך, עם ה-CSS וה-JavaScript.
- api/joke.js: הבדיחה מ-OpenAI ושמירה. api/laugh.js: "צחקתי". api/top.js: "הכי מצחיקות".
- טקסט מהשרת מוצג עם textContent, אף פעם לא innerHTML.
- בלי טעינה בטיימר. הרשימה נטענת בכניסה ואחרי פעולה.

## ריפו ופריסה
- ריפו ציבורי joke-app ב-GitHub, ענף main בלבד.
- הלינק החי ב-Vercel. כל push ל-main מתפרס לבד.
