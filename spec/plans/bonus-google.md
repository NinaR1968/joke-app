# בונוס: כניסה עם Google — תכנית

## מטרה
כפתור "המשך עם Google" בחלון הכניסה. אותו טוקן ואותן פונקציות ב-/api. בשרת ובבסיס הנתונים לא משתנה כלום, ואין SQL.

## שלב 1: ביד, בדשבורד (לפני הבדיקה, אפשר במקביל לבנייה)
1. Supabase: ‏Authentication ← Sign In / Providers ← Google. מעתיקים את Callback URL (for OAuth). עוד לא מדליקים.
2. Google Cloud Console: פרויקט חדש ← Google Auth Platform ← Get started: שם האפליקציה, מייל לתמיכה, Audience: ‏External.
3. Clients ← Create client ← Web application:
   - Authorized JavaScript origins: הכתובת ב-Vercel, בלי / בסוף. מי שמריץ במחשב: גם http://localhost:3000.
   - Authorized redirect URIs: ה-Callback URL מ-Supabase, בדיוק כמו שהוא.
   - מעתיקים Client ID ו-Client Secret.
4. חזרה ל-Supabase, לספק Google: ‏Enable, ‏Client IDs, ‏Client Secret, ‏Save. הסוד נשאר רק שם.
5. Redirect URLs כבר מכילות את הכתובת עם /** מ-Milestone 5. לא נוגעים.

## שלב 2: בנייה
1. **auth.js**:
   - בטעינה, לפני שהספרייה נוצרת: קוראים מהכתובת אם חזרנו מ-Google: ‏?code= או ?error= (גם בחלק שאחרי #).
   - `google()`: בודקת ב-`{url}/auth/v1/settings`, עם המפתח הציבורי בכותרת apikey, ש-`external.google` דולק. כבוי או לא עונה: שגיאה בעברית "הכניסה עם Google עוד לא מוגדרת", בלי לצאת מהדף. דולק: ‏`signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/' } })`.
   - `returned()`: מחזירה ok, ‏cancelled (‏error=access_denied), ‏failed (שגיאה אחרת, או code שלא הפך לטוקן), או null. אחרי ready הכתובת מתנקה עם history.replaceState: בלי code, ‏error ו-error_description.
   - השם: ‏Google שם full_name ב-user_metadata. ‏user() ו-displayName בשרת כבר קוראים אותו. לא משתנה.
2. **index.html**:
   - בחלון הכניסה, מעל שתי הלשוניות: כפתור לבן "המשך עם Google", גובה 54, מסגרת 3, צל קשה 5, בלי לוגו. מתחתיו קו מקווקו עם "או עם מייל וסיסמה".
   - לפני היציאה ל-Google, ב-sessionStorage (מפתח joke-app.return): הלשונית, הבדיחה שעל המסך (טקסט, id, שם, מספרים), וההצבעה שחיכתה ({ id, value }).
   - ההצבעה שמחכה הופכת מפונקציה בזיכרון לנתונים { id, value }, כדי שאפשר לשמור אותה.
   - בחזרה: משחזרים את הלשונית ואת הבדיחה, ומוחקים את המפתח. ‏ok: שולחים את ההצבעה מיד, ומעדכנים את הבדיחה או את הרשימה. ‏cancelled: חלון הכניסה נפתח עם "הכניסה עם Google בוטלה". ‏failed: "הכניסה עם Google לא הצליחה. נסו שוב." בשני המקרים האחרונים ההצבעה נמחקת.
3. **sw.js**: ‏joke-app-v7.

## החלטות לאישור
1. redirectTo הוא תמיד location.origin + '/'. הלשונית חוזרת מ-sessionStorage, לא מה-#, כי Supabase מדביק פרמטרים לכתובת.
2. בכתובות Preview של Vercel, שאינן ב-Redirect URLs, ‏Supabase יחזיר ל-Site URL. בודקים רק בכתובת הראשית או ב-localhost.
3. מייל שכבר נרשם עם סיסמה ונכנס עם Google באותו מייל: ‏Supabase מחבר אותם לאותו משתמש (ברירת המחדל). השם נשאר מה שנשמר קודם, אלא אם Google מעדכן את full_name.
4. בלי הלוגו של Google, לפי ה-spec.

## שלב 3: הרצה, דחיפה ובדיקה
בדיקה לפי חמשת תנאי ההשלמה בסוף MILESTONES.md, בכתובת החיה.

## סטטוס
התכנית אושרה ב-11.11.2026. שלב 2 (בנייה) הושלם:
- auth.js: ‏`google(beforeLeave)` ו-`returned()`. הכתובת מתנקה מ-code, ‏error, ‏error_code, ‏error_description ו-state, וה-# של הלשונית נשאר.
- index.html: כפתור "המשך עם Google" וקו "או עם מייל וסיסמה". ההצבעה שמחכה היא עכשיו { id, value, run }. שמירה ושחזור דרך sessionStorage (‏joke-app.return), ושליחת ההצבעה בחזרה. חזרה עם כפתור Back מ-Google (pageshow מהמטמון) מוחקת את מה שנשמר.
- sw.js: ‏joke-app-v7. תוספת שלא הייתה בתכנית: כתובת עם ? לא נשמרת במטמון, כדי ש-?code= לא יישמר ב-Cache Storage. גם תשובה שאינה ok לא נשמרת.
נבדק במחשב: תחביר תקין ב-auth.js, ‏sw.js ובסקריפט של הדף. ‏auth.js נבדק מול דפדפן ו-Supabase מדומים, ו-16 מתוך 16 בדיקות עברו: חזרה עם code וטוקן, code בלי טוקן, ביטול, שגיאה אחרי #, טעינה רגילה, Google כבוי, ‏settings לא עונה, ו-redirectTo. החלון נבדק בעין בדפדפן. עוד לא נבדק מול Google ו-Supabase האמיתיים, ועוד לא נדחף.
