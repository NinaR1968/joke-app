# Milestone 5: האפליקציה מכירה אותך — תכנית

## מטרה
הרשמה וכניסה עם מייל וסיסמה, שם לתצוגה, התנתקות ומחיקת חשבון. בדיחה של משתמש מחובר נשמרת עם השם שלו. רמה 3 לפי course-stack.md.

## שלב 0: ביד, בדשבורד של Supabase (לפני הקוד)
1. Authentication ← Sign In / Providers: לוודא ש-Allow new users to sign up דולק.
2. באותו מסך, בספק Email: לכבות את Confirm email, ו-Save.
3. Authentication ← URL Configuration: ב-Site URL הכתובת של האפליקציה ב-Vercel.
4. באותו מסך, Redirect URLs ← Add URL: אותה כתובת עם `/**` בסוף. מי שמריץ במחשב: גם `http://localhost:3000/**`.

## שלב 1: בסיס הנתונים
- migration בשם add_joke_authors, הקובץ db/add_joke_authors.sql:
  - `user_id uuid references auth.users (id) on delete set null`, ו-`author_name text`. שתיהן לא חובה.
  - check בשם jokes_author_name_length: null, או 1 עד 30 תווים אחרי btrim.
  - אינדקס jokes_user_id_idx על user_id.
  - בלי שינוי בנעילה. ה-grant הקיים (select, insert, update ל-service_role) חל על כל העמודות, גם החדשות.
- רץ דרך המחבר של Supabase רק אחרי אישור. אחרי ההרצה: get_advisors, הסבר בעברית, ועצירה.

## שלב 2: בנייה
1. **lib/http.js**: `json(data, status)` עם Cache-Control: no-store. `authRequired(message)`: ‏401 עם `code: "auth_required"`. `readJson(request, maxBytes = 10_000)`: קורא גוף עם מגבלת גודל, גוף שבור מחזיר `{}`.
2. **lib/supabase.js**: getSupabase נשאר כמו שהוא. נוספות:
   - `hasToken(request)`: יש כותרת `Authorization: Bearer ...` לא ריקה.
   - `getUserFromRequest(request, supabase)`: ‏`supabase.auth.getUser(token)`. אין טוקן או טוקן לא מוכר (401/403 מ-Supabase): null. Supabase לא זמין (רשת או 5xx): זורקת שגיאה.
   - `displayName(user)`: ‏`user_metadata.full_name`, אחרי trim, עד 30 תווים, או null.
3. **api/config.js**: GET בלבד. ‏`{ url, publishableKey }`. חסר אחד מהם, או שהמפתח מתחיל ב-`sb_secret_` או שהוא JWT עם role של service_role: ‏500 עם `code: "auth_not_configured"`.
4. **api/joke.js**:
   - יש טוקן: מזהים את המשתמש לפני OpenAI. טוקן לא מוכר: 401 auth_required, בלי לפנות ל-OpenAI. Supabase לא זמין: הבדיחה מגיעה בלי שמירה.
   - בשמירה: user_id ו-author_name מהמשתמש שזוהה בלבד. שום דבר מגוף הבקשה.
   - התשובה: `{ joke, id, author_name }`. ‏author_name הוא null לאורח.
   - שימוש ב-lib/http.js לתשובות ולקריאת הגוף.
5. **api/delete-account.js**: POST עם טוקן בלבד (אחרת 401). ‏`update jokes set author_name = null where user_id = <id>`, ואז `supabase.auth.admin.deleteUser(id)`. ה-FK מאפס את user_id לבד. מחזירה `{ deleted: true }`.
6. **auth.js** בשורש, חושף `window.Auth`:
   - `ready`: Promise שמביא את /api/config ויוצר לקוח עם `flowType: 'pkce'`, ‏persistSession, ‏autoRefreshToken.
   - `signUp(name, email, password)` עם `options.data.full_name`. ‏`signIn(email, password)`. ‏`signOut()` עם `scope: 'local'`.
   - `session()`, ‏`token()`, ‏`onChange(cb)`.
   - תרגום שגיאות לעברית: סיסמה/מייל שגויים, מייל כבר רשום, סיסמה קצרה, מייל לא תקין, יותר מדי ניסיונות, אין חיבור.
7. **index.html**:
   - `<script>` של `@supabase/supabase-js` מ-jsDelivr בגרסה קבועה (2.x, אותה גרסה כמו ב-package.json, אחרי בדיקה שהיא קיימת), ואחריו `/auth.js`.
   - כפתור חשבון בפינה העליונה השמאלית: "כניסה", או עיגול עם האות הראשונה והשם.
   - dialog כניסה: לשוניות "כניסה" ו"הרשמה". בהרשמה: "איך לקרוא לך?" (maxlength 30), מייל, סיסמה (minlength 6). הודעות בעברית בתוך החלון.
   - dialog "החשבון שלי": השם, המייל, "התנתקות", "מחיקת החשבון" עם `confirm()`.
   - Escape ולחיצה מחוץ לחלון סוגרים. עולה מלמטה בטלפון, באמצע במחשב.
   - פונקציית `call()` אחת: מוסיפה `Authorization: Bearer` אם יש טוקן. 401 עם auth_required כשנשלח טוקן: signOut, והודעה "צריך להתחבר שוב".
   - מתחת לבדיחה של מחובר: "נכתבה עכשיו בשבילך, " והשם מהשרת. לאורח: "נכתבה עכשיו" כמו היום.
   - "צחקתי" ו"הכי מצחיקות" בלי שינוי.
8. **sw.js**: ‏`joke-app-v5`, ו-`/auth.js` ברשימה.

## החלטות לאישור
1. מגבלת גוף: 10KB.
2. בדיקת "מפתח סודי" ב-config.js: קידומת `sb_secret_`, או JWT ישן עם role של service_role.
3. auth.js חושף אובייקט גלובלי אחד, `window.Auth`.
4. שאלת האישור למחיקת חשבון: `confirm()` של הדפדפן ("למחוק את החשבון? אי אפשר לבטל. הבדיחות שלך יישארו, בלי השם שלך.").
5. אם /api/config נכשל: כפתור החשבון מוסתר, והאפליקציה עובדת כאורח.

## שלב 3: ביד, אחרי שהקוד מוכן ולפני הדחיפה
1. ב-Vercel ← Settings ← Environment Variables: ‏SUPABASE_PUBLISHABLE_KEY, סוג Config (לא Sensitive), בכל הסביבות. את הערך אני מביא דרך המחבר עם get_publishable_keys.
2. SUPABASE_URL ו-SUPABASE_SECRET_KEY כבר שם מ-Milestone 4.

## שלב 4: דחיפה ובדיקה
push ל-main, ובדיקה לפי תנאי ההשלמה ב-MILESTONES.md.

## סטטוס
התכנית אושרה. שלב 1 הושלם בפרויקט joke-app ב-Supabase. בפרויקט לא הייתה טבלת jokes, ולכן רץ קודם create_jokes (db/create_jokes.sql, בלי שינוי), ואחריו add_joke_authors. get_advisors: שתי הערות INFO צפויות, rls_enabled_no_policy (הנעילה המכוונת) ו-unused_index (האינדקס חדש). שלב 2 (בנייה) הושלם: lib/http.js, עזרי הזיהוי ב-lib/supabase.js, api/config.js, api/delete-account.js, api/joke.js עם זיהוי מהטוקן לפני OpenAI ו-{ joke, id, author_name }, auth.js (window.Auth, pkce), ו-index.html עם כפתור חשבון, חלון כניסה/הרשמה וחלון "החשבון שלי". הספרייה @supabase/supabase-js@2.117.3 מ-jsDelivr עם integrity (SRI). sw.js בגרסה joke-app-v5 עם /auth.js.
נבדק במחשב: תחביר תקין בכל הקבצים. api/config.js מחזירה 500 auth_not_configured בלי משתנים ועם מפתח sb_secret_, ‏200 עם מפתח ציבורי, ו-405 ל-POST, תמיד עם no-store. גוף מעל 10KB או שבור נקרא כ-{}. חלון ההרשמה נראה תקין. עוד לא נבדק מול Supabase ו-OpenAI.
נדחף ל-main (041ceee). SUPABASE_PUBLISHABLE_KEY נוסף ב-Vercel (Config, כל הסביבות), ו-Redeploy. התגלה ש-SUPABASE_URL ב-Vercel כולל /rest/v1/ בסוף. התיקון: projectUrl() ב-lib/supabase.js לוקחת רק את ה-origin, ו-config.js משתמשת בה (7b24b84). ‏/api/config מחזירה 200 עם הכתובת הנקייה והמפתח הציבורי בלבד, עם no-store.
**Milestone 5 הושלם.** כל שמונת תנאי ההשלמה נבדקו ידנית בכתובת החיה ועברו, ב-11.11.2026. הבא: Milestone 6, בשיחה חדשה.
