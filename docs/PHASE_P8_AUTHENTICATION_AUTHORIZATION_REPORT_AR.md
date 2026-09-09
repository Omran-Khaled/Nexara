# تقرير تنفيذ المرحلة P8 — المصادقة والتفويض

## النتيجة التنفيذية

تم تحويل مصادقة وتفويض Nexara إلى نموذج خادمي واضح. تتحقق طبقة الخادم من **هوية Supabase** عبر endpoint المستخدم الموثق، ثم تحل الأدوار من مستودع `role_assignments` الدائم في MongoDB. لا يمنح البريد الإلكتروني ولا `app_metadata.role` ولا الدور المرسل من الواجهة صلاحيات تشغيلية. صار `NEXARA_ADMIN_EMAILS` خارج نموذج الإنتاج ولم يعد يقرأه الخادم أو يوثقه كوسيلة منح دور.

> هوية Supabase تثبت من هو المستخدم؛ أما ما يمكنه فعله فيقرره الخادم من تعيينات الأدوار وصلاحياتها.

| طبقة الحماية | تنفيذ P8 |
|---|---|
| Identity | يتحقق الخادم من Bearer token لدى Supabase قبل إنشاء `principal`. |
| Roles | `READER` و`MODERATOR` و`ADMIN` تحفظ كتعيينات مستقلة في `role_assignments`. |
| Permissions | تستخرج في الخادم من الدور، ولا يقبل API صلاحية أو دوراً من body أو ترويسة في الإنتاج. |
| Ownership | متحكمات القراءة والمكتبة تربط `userId` بهوية principal؛ وتبقى عمليات المستودع مقيدة بـ`{id,userId}`. |
| Admin | إدارة الأدوار محمية بـ`ROLE_MANAGE`، مع منع رفع المدير لنفسه أو إزالة دوره الإداري ذاتياً. |
| Audit | عمليات الحقوق وسجل التدقيق تتطلبان الصلاحيات الخادمية المحددة. |

## نموذج الوصول

| الدور | الصلاحيات | الاستخدام |
|---|---|---|
| `READER` | لا توجد صلاحيات إدارية | إدارة مكتبة المستخدم وقراءته وتنزيلاته المصرح بها ضمن حقوق الكتاب. |
| `MODERATOR` | `CATALOG_WRITE` | إنشاء وتعديل وحذف كتالوج غير منشور وفق قيود سير العمل. |
| `ADMIN` | `CATALOG_WRITE`، `FILE_WRITE`، `RIGHTS_MANAGE`، `AUDIT_READ`، `ROLE_MANAGE` | إدارة المحتوى والملفات والحقوق والسجل وتعيينات الدور. |

تُحفظ كل عملية تعيين في سجل يحتوي على `id` و`userId` و`role` و`assignedBy` و`createdAt`. يمنع الفهرس الفريد `{ userId, role }` التعيين المكرر، ويضمن فهرس المستخدم حل الأدوار بكفاءة.

## مسار المصادقة والتفويض

```text
Bearer token
  → Supabase /auth/v1/user
  → AuthPrincipal
  → MongoDB role_assignments
  → roles + permissions على الخادم
  → requirePrincipal / requirePermission / requireRole
  → endpoint أو رفض 401/403
```

### واجهات P8

| الطريقة | المسار | الحماية |
|---|---|---|
| `GET` | `/api/auth/me` | مستخدم موثق؛ يعرض الهوية والأدوار والصلاحيات المقررة من الخادم. |
| `POST` | `/api/admin/users/:userId/roles` | `ROLE_MANAGE` فقط. |
| `DELETE` | `/api/admin/users/:userId/roles` | `ROLE_MANAGE` فقط. |

تمت أيضاً حماية إنشاء/تعديل/حذف الكتب بـ`CATALOG_WRITE`، ورفع الملفات بـ`FILE_WRITE`، وتسجيل الحقوق بـ`RIGHTS_MANAGE`، وقراءة سجل التدقيق بـ`AUDIT_READ`.

## الترحيل والتشغيل

أضيفت الهجرة `p8-authorization-roles-v1`. تنشئ أو تحدث validator لمجموعة `role_assignments`، وتضيف فهارسها، وتوسّع تمثيل دور المستخدم ليقبل `MODERATOR`. يبدأ خادم الإنتاج الآن بـ`applyP8AuthorizationMigration` ثم ينشئ `MongoAuthorizationRepository` ويمرره إلى المصادقة والتطبيق.

يتطلب تشغيل الإنتاج `SUPABASE_URL` و`SUPABASE_PUBLISHABLE_KEY`، إضافة إلى MongoDB. لا تفعّل بيئة الإنتاج `allowTestIdentity`؛ ترويسات الاختبار موجودة فقط لحزمة الاختبارات عند تفعيلها صراحةً.

## ملكية الموارد ومنع IDOR

لا تقبل متحكمات bookmark وhighlight وcollection وreading progress وruntime قيمة `userId` المرسلة من العميل كمصدر ملكية. تُستبدل القيمة بهوية `requirePrincipal(req).id`، كما تقيد طبقة المستودع تعديل أو حذف المورد بـمعرف المستخدم الموثق. لذلك يفشل تخمين معرف bookmark لمستخدم آخر كـ`404` بدلاً من كشف أو تعديل المورد.

## بوابة القبول P8

تمت إضافة الأمر التالي:

```bash
npm run test:p8
```

| حالة البوابة | النتيجة |
|---|---|
| guest | ناجح؛ `GET /api/auth/me` بلا هوية يعيد `401`. |
| authenticated user | ناجح؛ principal للقارئ يحل من مخزن الأدوار، لا من ترويسة تدعي `ADMIN`. |
| normal reader | ناجح؛ لا يستطيع تعديل الكتالوج أو قراءة السجل. |
| moderator | ناجح؛ يستطيع تعديل الكتالوج عبر `CATALOG_WRITE` ولا يستطيع إدارة الأدوار. |
| admin | ناجح؛ يستطيع تعيين دور moderator من مسار إداري محمي. |
| forbidden resource | ناجح؛ القارئ يحصل على `403` عند طلب audit logs. |
| IDOR attempts | ناجح؛ `userId` في body لا يتجاوز الهوية، وحذف bookmark لمستخدم آخر يعيد `404`. |

## أوامر التحقق المنفذة

```bash
npm run lint
npm run build
npm run test:p4:files
./node_modules/.bin/tsx tests/p4.book-files-api.test.ts
npm run test:p5:reader
npm run test:p6:security
npm run test:p6:downloads
npm run test:p7
npm run test:p8
```

نجحت جميع الأوامر. ظهر تحذير Vite غير مانع بخصوص حجم bundle الواجهة؛ لا يؤثر في بناء المشروع أو اختبارات P8.

## ملفات التنفيذ الرئيسية

| الملف | التغيير |
|---|---|
| `server/auth/AuthorizationRepository.ts` | الأدوار والصلاحيات وتعيينات الذاكرة وMongoDB. |
| `server/middleware/auth.ts` | تحقق Supabase وحل الأدوار الخادمي وguards للصلاحيات. |
| `server/controllers/AuthorizationController.ts` | واجهات `me` وإدارة الأدوار. |
| `server/routes/authorizationRoutes.ts` | مسارات الإدارة المحمية. |
| `server/db/migrations.ts` و`server/db/indexes.ts` | هجرة وفهارس `role_assignments`. |
| `server.ts` | تشغيل هجرة P8 وحقن مستودع MongoDB للتفويض. |
| `server/controllers/BookController.ts` | تفويض تحرير الكتالوج. |
| `server/controllers/BookFileController.ts` | تفويض رفع الملفات. |
| `server/controllers/LibraryControllers.ts` | تفويض الحقوق وسجل التدقيق. |
| `tests/p8.authentication-authorization.test.ts` | بوابة P8 الشاملة. |

## ملاحظة تشغيلية

يحتاج الفريق التشغيلي إلى إجراء controlled bootstrap لأول مسؤول في `role_assignments` باستخدام migration أو runbook موثوق، ثم يجب أن تتم التعيينات اللاحقة عبر endpoint الإدارة المحمي وحساب إداري قائم. لا تستخدم قائمة بريد، ولا claim من واجهة المستخدم، ولا تغييراً محلياً في المتصفح كمرجع لصلاحية الإنتاج.
