# نشر Nexara في بيئة إنتاج حقيقية

## مبدأ الإطلاق

لا يبدأ الإطلاق من بناء الواجهة فقط. يلزم إثبات أن MongoDB وSupabase Auth والتخزين المتوافق مع S3 وClamAV متاحة للنسخة التي ستستقبل المستخدمين. فعّل `NEXARA_STARTUP_READINESS_REQUIRED=true` في بيئة الإنتاج؛ عندئذ يرفض الخادم الاستماع إذا فشلت تبعية مطلوبة في readiness.

## المتطلبات الخارجية

| الخدمة | إعداد مطلوب | تحقق قبل الإطلاق |
|---|---|---|
| MongoDB | مستخدم تطبيق محدود الصلاحية وقاعدة بيانات `nexara`. | اتصال و`ping` وmigrations وفهارس ونسخة احتياطية. |
| Supabase Auth | مشروع مخصص للبيئة ومفتاح publishable فقط في الواجهة. | استجابة Auth وإنشاء قارئ ومدير اختبار. |
| S3/R2/MinIO | Bucket خاص، endpoint HTTPS، ومفاتيح IAM بالحد الأدنى. | `HeadBucket` ثم رفع وقراءة وتنزيل ملف اختبار حقيقي. |
| ClamAV | `clamdscan` متاح لعملية Nexara ومتصل بالـdaemon. | readiness وفحص ملف نظيف ورفض عينة اختبار آمنة معتمدة داخلياً. |
| HTTPS | نطاق وشهادة ووكيل عكسي موثوق. | لا يقبل المتصفح HTTP، وتطابق origins مع CORS. |

لا تستخدم بيانات اعتماد التطوير أو خدمة مشتركة بين البيئات. افصل MongoDB وSupabase وbucket ومفاتيح الوصول بين التطوير وstaging والإنتاج.

## تهيئة البيئة

1. انسخ `.env.example` إلى مخزن أسرار المنصة أو ملف بيئة لا يدخل المستودع.
2. اضبط `NODE_ENV=production` و`NEXARA_STARTUP_READINESS_REQUIRED=true`.
3. اضبط `NEXARA_CORS_ORIGINS` إلى origins HTTPS كاملة بلا مسارات. اضبط `NEXARA_TRUST_PROXY_HOPS` بعدد الوكلاء المعروفين فقط.
4. اضبط `MONGODB_URI` و`MONGODB_DB_NAME`، وقيم Supabase على المشروع ذاته في متغيرات الخادم و`VITE_`.
5. اضبط `BOOK_STORAGE_PROVIDER=s3` وجميع قيم `BOOK_STORAGE_*`. التخزين المحلي غير مقبول في الإنتاج.
6. اضبط `BOOK_MALWARE_SCANNER=clamdscan` و`BOOK_REQUIRE_MALWARE_SCAN=true`.

> لا تمرر `service_role` من Supabase إلى الواجهة ولا إلى ملف بناء Vite. يستخدم Nexara مفتاحاً publishable للتحقق من الجلسة، وتحل الأدوار من MongoDB في الخادم.

## تسلسل الإطلاق القابل للإعادة

نفذ الخطوات من بيئة CI أو عامل نشر يمتلك أسرار البيئة، لا من جهاز مطور شخصي. لا تعرض مخرجات البيئة أو مفاتيح الوصول في سجل CI.

```text
configure secrets
→ npm ci --ignore-scripts
→ npm run lint
→ npm run build
→ npm run db:migrate
→ npm run catalog:ingest
→ npm run production:preflight
→ deploy release
→ NEXARA_DEPLOY_URL=https://<domain> npm run production:smoke
→ manual real-user and real-admin tests
```

`db:migrate` ينشئ migrations والفهارس اللازمة، و`catalog:ingest` لا ينشر مرشحاً لا يثبت مصدره وحقوقه وملفه وفصوله. استخدم `--dry-run` حيث يدعمه مسار الإدخال لمراجعة المخرجات قبل أي كتابة تشغيلية.

## الوكيل العكسي والشبكة

أنهِ TLS لدى موازن حمل أو وكيل عكسي موثوق، ثم مرر `X-Forwarded-Proto` و`X-Forwarded-For` بصورة محكومة. لا تعرّض منفذ Node مباشرة إلى الإنترنت من دون TLS. اضبط حد حجم الطلب لدى الوكيل بما لا يزيد على `BOOK_STORAGE_MAX_BYTES`، وطبّق rate limiting موزعاً عند الحافة إذا نُشرت أكثر من نسخة من التطبيق؛ المحدد داخل التطبيق في الذاكرة ولا يتشارك العدادات بين العمليات.

اسمح للوصول إلى MongoDB وS3 وSupabase وClamAV من شبكة التطبيق فقط. امنع الوصول العام إلى bucket؛ يمنح التطبيق روابط قراءة موقعة قصيرة العمر بعد التفويض.

## بوابات القبول

| البوابة | دليل النجاح | الإجراء عند الفشل |
|---|---|---|
| البناء | `npm run lint` و`npm run build` برمز خروج صفر. | أوقف الإصدار. |
| preflight | تقرير JSON فيه كل checks بحالة `ok`. | لا تنشر، وأصلح التبعية المحددة. |
| readiness | `/api/health/ready` يعيد HTTP 200 و`ready: true`. | أخرج النسخة من موازن الحمل. |
| smoke | `production:smoke` يثبت health وSupabase والكتالوج المنشور. | أوقف الترقية أو نفذ rollback. |
| اختبار المستخدم | حساب قارئ حقيقي: دخول، بحث، قراءة، حفظ، تحديث، استئناف، تنزيل إن سمحت الحقوق. | لا تعلن الجاهزية. |
| اختبار المدير | حساب إداري حقيقي: إدخال، حقوق، ملف، نشر، ظهور للمستخدم، إيقاف ظهور. | لا تعلن الجاهزية. |

## التراجع عن إصدار

احتفظ بالصورة/البنية السابقة وإعداداتها المتوافقة. عند فشل readiness أو smoke بعد النشر، أزل الإصدار الجديد من موازن الحمل، وأعد تشغيل الإصدار السابق، ثم تحقق من `/api/health/ready`. لا تتراجع عن قاعدة البيانات عشوائياً: راجع migrations المنفذة، وخطة rollback الخاصة بها، ونسخة قاعدة البيانات قبل أي استعادة.

## ما يجب حفظه كدليل

احفظ، في موقع وصول إداري محمي، وقت الإصدار وhash البنية، ونتيجة preflight، ونتيجة smoke، ونتيجة اختبارات المستخدم والمدير، وحالة النسخ الاحتياطية. عدم توافر واحد من هذه الأدلة يجعل حكم الإصدار **NOT READY**.

## نشر Vercel مع Supabase Storage وخدمة الفحص

يخدم `vercel.json` الواجهة من `dist` ويربط `/api/*` بمدخل `api/index.ts`. تهيئ هذه الوظيفة تطبيق Nexara المشترك وتحتفظ باتصال MongoDB ضمن عملية الوظيفة الدافئة حيث أمكن. لا تضبط `NEXARA_APPLY_MIGRATIONS_ON_STARTUP=true` في Vercel؛ شغّل `npm run db:migrate` كعملية نشر متحكم بها قبل النشر لتجنب migrations متزامنة أثناء cold starts.

لأن Vercel يحد جسم طلب الوظيفة، لا تمرر كتاباً كبيراً إلى `POST /files` مباشرة في الإنتاج. يستخدم المسار الجديد خطوتين إداريتين: `POST /files/direct-upload` ينشئ رابط كتابة S3 قصير العمر إلى مسار staging، ثم يرفع المتصفح الملف مباشرة مع `Content-Type` المطلوب، وبعدها يستدعي `POST /files/complete-direct-upload`. يستعيد Nexara الملف من staging، ويطبق فحص المحتوى وفحص البرمجيات الضارة، ثم ينقله إلى مسار النسخة المنشورة ويحذف كائن staging. لا ينشر سجل ملف عندما يفشل التحقق.

تتطلب وظائف Vercel خدمة فحص HTTPS مستقلة؛ أضيفت الخدمة المرجعية في `services/clamav-scanner/`. تنفذ `GET /health` و`POST /scan` مع رمز bearer خادمي، وتغلف ClamAV داخل حاوية. انشرها في مزود حاويات مستقل، ثم اضبط في متغيرات Vercel:

```text
BOOK_MALWARE_SCANNER=remote-http
BOOK_MALWARE_SCANNER_URL=https://<scanner-domain>
BOOK_MALWARE_SCANNER_TOKEN=<server-only-token>
BOOK_REQUIRE_MALWARE_SCAN=true
```

اضبط بقية متغيرات Vercel من `.env.example`، بما فيها MongoDB وSupabase و`BOOK_STORAGE_*`. لا تضع `BOOK_STORAGE_SECRET_KEY` أو token الفاحص في أي متغير يبدأ بـ`VITE_`.

> لا يصبح الإصدار جاهزاً حتى ينجح readiness في Vercel، وتنجح صحة خدمة ClamAV المستقلة، ويجتاز رفع مباشر لملف حقيقي وفحصه ثم تنزيله من حساب قارئ مفوض.
