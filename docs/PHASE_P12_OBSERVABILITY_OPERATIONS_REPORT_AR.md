# تقرير المرحلة P12 — الرصد والعمليات

**المشروع:** Nexara Digital Library  
**المرحلة:** P12 — Observability & Operations  
**تاريخ التنفيذ:** 18 أغسطس 2026  
**حالة بوابة الشفرة:** **PASS**

> تفصل P12 بين أن تكون عملية Node/Express حية وبين أن تكون الخدمة جاهزة لاستقبال الحركة. لا يمكن أن تعيد `/api/health` نجاحاً في الخادم الفعلي بينما يفشل اتصال MongoDB أو مزود تخزين مطلوب أو تبعية إنتاجية إلزامية.

## 1. التسجيل المنظم

أضيفت طبقة `server/observability/logger.ts` التي تخرج كائن JSON واحداً لكل حدث على stdout/stderr. لا تسجل الطبقة أجسام الطلبات أو رموز التفويض أو ملفات تعريف الارتباط أو كلمات المرور أو الأسرار أو stack traces. وهذا يجعل السجلات قابلة للفهرسة في أدوات التجميع الشائعة دون تحويلها إلى قناة تسريب لمحتوى المستخدم.

| الحدث | المستوى النموذجي | الحقول الرئيسية |
|---|---|---|
| `http_request_completed` | `info` / `warn` / `error` | `requestId`، `userId` إن وجد، `method`، `route`، `latencyMs`، `statusCode`، `outcome` |
| `database_error` | `error` | سياق الطلب والمسار وكود الحالة؛ يستخدم لأخطاء المستودعات ولـ MongoDB غير الجاهزة |
| `authentication_failed` | `warn` | معرّف الطلب والمسار والحالة 401 |
| `authorization_denied` | `warn` | معرّف الطلب والمسار والحالة 403 |
| `provider_error` | `error` | سياق الطلب واسم المزوّد عندما يقدمه الخطأ الموثوق |
| `download_event` | `info` / `warn` / `error` | المستخدم، معرّف الطلب، مزود التخزين، الملف، وقرار التنزيل |
| `health_liveness` | `info` | معرّف الطلب ومسار liveness |
| `health_readiness` | `info` / `error` | ملخص نتائج التبعيات وحالة الجاهزية |
| `dependency_unavailable` | `error` | التبعية المطلوبة الفاشلة أثناء readiness |

ينشئ `requestReliability` أو يعيد استعمال `X-Request-ID` صالحاً، ويعيده في رأس الاستجابة، ثم يسجل نتيجة الطلب عند انتهاء الاستجابة. بعد مرور المصادقة، يسحب السجل `userId` من principal المعتمد لا من جسم الطلب. يعتمد حقل `route` على مسار Express المعنّى ويستبعد query string.

## 2. واجهات الحالة

| المسار | الغرض | يختبر MongoDB؟ | النتيجة الناجحة | عند فشل تبعية مطلوبة |
|---|---|---:|---:|---:|
| `GET /api/health/live` | **Liveness** للعملية فقط | لا | `200` | لا يستخدم لتقرير التبعيات |
| `GET /api/health` | **Readiness** متوافق مع المسار السابق | نعم | `200` | `503` |
| `GET /api/health/ready` | **Readiness** صريح | نعم | `200` | `503` |

تعيد readiness الحقول `status` و`ready` و`checkedAt` وقائمة بالتبعيات التي تتضمن الاسم، وهل هي مطلوبة، والحالة، وزمن الفحص. لا تعرض الاستجابة URI لـ MongoDB، مفتاح Supabase، endpoint التخزين، رسالة مزود تفصيلية، أو أثر تنفيذ.

## 3. التبعيات التي تتحقق منها readiness

في تركيب الخادم الحقيقي، تستدعي readiness الفحوص التالية بالتوازي وبمهلة محلية محدودة. يؤدي فشل أي بند معلن بأنه مطلوب إلى `503` و`ready: false`.

| التبعية | متى تكون مطلوبة | الفحص غير المتلف |
|---|---|---|
| MongoDB | دائماً | أمر MongoDB `ping` مع حد زمني. |
| مزود تخزين الكتب | دائماً في الخادم الحقيقي | `fs.access` للتخزين المحلي أو `HeadBucket` لمزود S3-compatible. |
| Supabase Auth | عند `NODE_ENV=production` | طلب إعدادات Auth قصير ومصدق بمفتاح النشر. |
| ClamAV / `clamdscan` | عند `BOOK_REQUIRE_MALWARE_SCAN=true` | مسح probe نصي قصير عبر الماسح المفروض. |

يتحقق الخادم عند البدء من وجود إعداد MongoDB، ولكنه لا يفترض أن نجاح البدء يكفي إلى الأبد. إذا انقطع MongoDB بعد البدء، يفشل `MongoDatabase.ping()` في readiness التالية وتصبح `/api/health` و`/api/health/ready` بحالة `503` حتى تعود التبعية.

## 4. أحداث التنزيل والأخطاء

تظل سجلات التدقيق الدائمة موجودة في `audit_logs`، لكن P12 تضيف حدثاً منظماً فور كل قرار تنزيل: تفويض، رفض الحقوق، ملف مفقود، ملف تالف، أو مزود مصدر غير متاح. يحمل الحدث `requestId` إن كان متاحاً و`userId` واسم مزود التخزين، ولا يحمل رابط تنزيل موقّعاً أو معلومات الحقوق التفصيلية أو محتوى الملف.

تعالج `errorHandler` أخطاء `DatabaseError` و`AuthenticationError` و`AuthorizationError` و`ExternalProviderError` و`ProviderError` كفئات مستقلة. وبهذا يظهر فشل MongoDB أو فشل مصادقة أو تعطل مزود في نظام الرصد بحدث مفهوم مع استجابة API الموحدة التي لا تزال تحمل `requestId` للمطابقة.

## 5. التحقق

| الفحص | النتيجة | الدلالة |
|---|---|---|
| `npm run lint` | ناجح | تحقق TypeScript من عقود الرصد والصحة. |
| `npm run test:p12` | ناجح | يثبت أن liveness تعيد 200، وأن readiness تفشل 503 عند تعطل تبعية مطلوبة، وأن سجل الطلب يحمل request ID والمستخدم والمسار والكمون والحالة. |
| `npm run build` | ناجح | يبني Vite وخادم الإنتاج بعد P12. |
| `scripts/audit-runtime-smoke.ts` | ناجح مع MongoDB مؤقتة | يتحقق من liveness وreadiness وMongoDB في التشغيل الفعلي. |

## 6. الملفات المرجعية

| الملف | المسؤولية |
|---|---|
| `server/observability/logger.ts` | مخرج JSON منظم وتنقية الحقول الحساسة. |
| `server/observability/health.ts` | نمذجة وفحص liveness/readiness. |
| `server/middleware/requestReliability.ts` | request ID وسجل إتمام كل طلب. |
| `server/middleware/errorHandler.ts` | تصنيف أخطاء DB/Auth/Provider دون كشف تفاصيل. |
| `server/db/mongoClient.ts` | MongoDB `ping` الفعلي. |
| `server/storage/StorageProvider.ts` | فحص local/S3 storage غير المتلف. |
| `server/security/FileUploadSecurity.ts` | فحص جاهزية الماسح عند فرضه. |
| `server.ts` | تركيب تبعيات readiness في بيئة الخادم الحقيقية. |
| `tests/p12.observability-operations.test.ts` | بوابة قبول P12. |

> **قرار P12:** PASS على مستوى الشفرة والاختبارات. تبقى صلاحية الموارد الحية الفعلية مرتبطة بإعداد المستخدم؛ لكن عندما لا تكون MongoDB أو التخزين أو تبعية إلزامية متاحة، تعلن readiness الفشل بـ `503` بدلاً من تقديم خدمة Express تبدو سليمة ظاهرياً.
