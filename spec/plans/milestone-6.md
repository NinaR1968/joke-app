# Milestone 6: הקהילה מדרגת — תכנית

## מטרה
"אהבתי" ו"לא אהבתי" במקום "צחקתי", קול אחד לכל משתמש לכל בדיחה, לשונית קהילה ולשונית אהבתי.

## שלב 1: בסיס הנתונים
- migration בשם create_votes, הקובץ db/create_votes.sql:
  - טבלה public.votes: ‏user_id (חובה, cascade מ-auth.users), ‏joke_id (חובה, cascade מ-public.jokes), ‏value (smallint, ‏1 או 1-), ‏voted_at (now). מפתח ראשי (user_id, joke_id). אינדקס votes_joke_id_idx.
  - נעילה: RLS דולק בלי policy, ‏revoke all מ-anon ומ-authenticated, ‏grant select, insert, update, delete ל-service_role.
  - cast_vote(voter, target, new_value), ‏plpgsql: ‏1/1- עם on conflict do update, ‏0 מוחקת. מחזירה likes, dislikes, my_vote. שגיאות: ‏P0002 בדיחה לא קיימת, ‏22023 ערך לא חוקי או בלי voter.
  - joke_feed(viewer, mode, max_rows default 20), ‏sql, ‏stable: ‏new, ‏top, ‏liked. לא מחזירה user_id. ‏max_rows נחתך ל-1 עד 50. מצב לא מוכר: רשימה ריקה.
  - בשתיהן: security invoker, ‏search_path ריק, שמות מלאים. ‏revoke execute מ-public, anon, authenticated, ו-grant ל-service_role.
  - laughs ו-add_laugh לא נוגעים בהם.
- רץ דרך המחבר רק אחרי אישור. אחרי ההרצה: get_advisors, הסבר בעברית, ועצירה.

## שלב 2: בנייה
1. **api/vote.js**: ‏POST, טוקן חובה (אחרת 401 auth_required). גוף { id, value }: ‏id חייב להיות uuid, ‏value בדיוק 1, ‏1- או 0 כמספר (אחרת 400). ‏voter רק מ-getUserFromRequest. ‏rpc('cast_vote'). ‏P0002: ‏404. מחזירה { likes, dislikes, my_vote }.
2. **api/feed.js**: ‏GET, ‏mode של new, top או liked (אחר: 400). טוקן רשות ל-new ו-top, חובה ל-liked. טוקן לא מוכר: 401 auth_required. ‏Supabase Auth לא זמין: new ו-top עדיין עובדים כאורח, liked מחזיר 502. שורות: ‏20 / 10 / 50. מחזירה { jokes } עם השדות של החוזה בלבד.
3. מחיקה: api/laugh.js ו-api/top.js.
4. **index.html**:
   - רכיב הצבעה אחד, `voteBar(joke)`: שני כפתורים עם אגודל SVG (קו כשלא מסומן, מלא כשמסומן), המספר ליד כל אחד, ‏aria-pressed. אהבתי מסומן במנטה, לא אהבתי בוורוד. לחיצה על המסומן שולחת 0. בזמן הבקשה שניהם disabled. המספרים מתעדכנים רק מתשובת השרת.
   - אורח לוחץ: ההצבעה נשמרת בזיכרון, ונפתח חלון הכניסה עם "כדי לדרג בדיחות צריך חשבון". אחרי כניסה או הרשמה היא נשלחת לבד. סגירת החלון בלי כניסה מבטלת אותה.
   - שלוש לשוניות בתחתית, כרטיס לבן צף: בדיחה, קהילה, אהבתי. ‏#joke, ‏#community, ‏#liked עם hashchange. כתובת בלי # או לא מוכרת: בדיחה.
   - בדיחה: המסך הקיים, רכיב ההצבעה במקום "צחקתי", וקישור "לכל הבדיחות בקהילה". "הכי מצחיקות" יורד מהלשונית הזו.
   - קהילה: מתג "חדשות" / "הכי מצחיקות". כרטיסים מסובבים לסירוגין, הבדיחה בכתב יד 19, הנושא, "של" והשם או "בדיחה אנונימית", ורכיב ההצבעה. ב"הכי מצחיקות" עיגול דירוג בפינה.
   - אהבתי: לאורח מסך נעול עם הדמות, הסבר וכפתור כניסה. למחובר: הרשימה. ביטול "אהבתי" מוציא את הכרטיס.
   - טעינה רק בכניסה ללשונית, במעבר מיון, ואחרי כניסה או יציאה (הלשונית הפתוחה). בלי טיימר.
   - הקוד של "צחקתי" והמפתח joke-app.laughed ב-localStorage יוצאים.
5. **sw.js**: ‏joke-app-v6.

## החלטות לאישור
1. קודי השגיאה מ-cast_vote: ‏P0002 ← 404, ‏22023 ← 400. ‏api/vote.js בודק את הערך גם לפני הקריאה.
2. האייקונים: SVG קטן בתוך הקוד (נבנה עם createElementNS, לא innerHTML), בלי קבצים חדשים ב-assets.
3. ההצבעה שמחכה לכניסה נשמרת בזיכרון של הדף בלבד. sessionStorage רק בבונוס של Google.
4. בלי עדכון אופטימי: המספרים זזים אחרי תשובת השרת.
5. המיון שנבחר בקהילה נשמר רק בזיכרון. ה-# נשאר רק ללשונית.

## שלב 3: ביד
אין משתנים חדשים ב-Vercel.

## שלב 4: הרצה, דחיפה ובדיקה
בדיקה לפי תשעת תנאי ההשלמה ב-MILESTONES.md, בכתובת החיה או עם vercel dev.

## סטטוס
התכנית וה-SQL אושרו. שלב 1 הושלם: create_votes רץ בפרויקט joke-app ב-Supabase. נבדק: RLS דולק, אפס policies, ל-anon ול-authenticated אין שום הרשאה על votes ואין execute על cast_vote ו-joke_feed. ל-service_role יש execute על שתיהן. joke_feed(null, 'new') מחזירה את 4 הבדיחות הקיימות, ו-liked לאורח מחזירה 0.
get_advisors: ‏rls_enabled_no_policy על jokes ועל votes (INFO, הנעילה המכוונת), ‏unused_index על votes_joke_id_idx ועל jokes_user_id_idx (INFO, אינדקסים חדשים), ו-auth_leaked_password_protection (WARN, הגדרה של Auth, לא של הטבלה).
הערה: ל-service_role יש על votes גם REFERENCES, ‏TRIGGER ו-TRUNCATE, מההרשאות שמוגדרות כברירת מחדל ב-Supabase. זה לא פותח כלום לדפדפן.
שלב 2 (בנייה) הושלם: api/vote.js, ‏api/feed.js, נמחקו api/laugh.js ו-api/top.js. ‏index.html: רכיב הצבעה voteBar עם אגודל SVG (createElementNS), שלוש לשוניות עם #, קהילה עם "חדשות" ו"הכי מצחיקות" ודירוג בפינה, אהבתי עם מסך נעול לאורח, הצבעה שמחכה לכניסה, וטעינה מחדש כשמתחלף המשתמש. הקוד של "צחקתי" הוסר, והמפתח הישן ב-localStorage מתנקה. ‏sw.js בגרסה joke-app-v6.
נבדק במחשב: תחביר תקין בכל הקבצים ובסקריפט של הדף. ‏vote.js ו-feed.js נבדקו מול לקוח Supabase מדומה: ‏405, ‏401 בלי טוקן ועם טוקן לא מוכר, ‏400 ל-value 5, ל-"1" כמחרוזת ול-id שבור, ‏404 לבדיחה שלא קיימת, ‏voter תמיד מהטוקן גם כש-user_id בגוף, ו-feed לא מחזירה user_id. כל התשובות עם no-store. המסך עוד לא נבדק בדפדפן, ועוד לא מול Supabase האמיתי.
הבא: דחיפה ובדיקה בכתובת החיה.
