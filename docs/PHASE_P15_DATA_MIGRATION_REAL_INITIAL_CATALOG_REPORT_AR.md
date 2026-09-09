# P15 — ترحيل البيانات والكتالوج الأولي الحقيقي

**تاريخ التنفيذ:** 18 أغسطس 2026  
**حالة المرحلة:** **PASS في البيئة المعزولة**  
**القرار:** صار الكتالوج الأولي يُبنى حصراً عبر `npm run catalog:ingest` من قائمة صغيرة ومراجعة يدوياً لكتب حقيقية من **Standard Ebooks**. لا يقرأ هذا المسار `mockDatabase.ts` ولا fixtures الواجهة، ولا ينشر سجلاً قبل اجتياز دليل الحقوق، والملف الثنائي، والبصمة، والفصول المقروءة، والغلاف، والتحقق من المصدر.[1] [2]

> **قاعدة النشر P15:** الترحيل يعامل كل كتاب كمرشح محجوب. لا يتحول إلى `PUBLISHED` و`FULL_TEXT` إلا بعد أن تحفظ MongoDB كل metadata والطبعة والحقوق، وتحفظ طبقة التخزين EPUB والغلاف وتتطابق بصماتهما، وتنتج قراءة EPUB فصلين فعليين على الأقل قابلين للقراءة.

## 1. كتالوج الإطلاق الحقيقي

| العمل | المؤلف | المصدر | النسخة والملف | وضع الحقوق المسجل |
|---|---|---|---|---|
| *Pride and Prejudice* | Jane Austen | [Standard Ebooks][3] | EPUB متوافق، غلاف المصدر، ومصدر GitHub للنسخة | `PUBLIC_DOMAIN` في `US` فقط؛ لا يسجل الترخيص كعالمي. |
| *Frankenstein* | Mary Shelley | [Standard Ebooks][4] | EPUB متوافق، غلاف المصدر، ومصدر GitHub للنسخة | `PUBLIC_DOMAIN` في `US` فقط؛ لا يسجل الترخيص كعالمي. |
| *The Picture of Dorian Gray* | Oscar Wilde | [Standard Ebooks][5] | EPUB متوافق، غلاف المصدر، ومصدر GitHub للنسخة | `PUBLIC_DOMAIN` في `US` فقط؛ لا يسجل الترخيص كعالمي. |

اختيرت Standard Ebooks لأنها تصف إصداراتها بأنها كتب ملكية عامة محررة ومفتوحة المصدر، وتخصص عملها في كل إصدار للملكية العامة عبر CC0. مع ذلك، تذكر صفحة كل عمل صراحة أن الخلو من القيود يتعلق بالولايات المتحدة وقد تختلف الحالة في بلدان أخرى؛ لذلك يثبت P15 `territory: US` ولا يتجاوز هذا النطاق.[1] [3] [4] [5]

## 2. ما نُفذ

| الأصل | الوظيفة |
|---|---|
| `server/catalog/InitialCatalogIngestion.ts` | القائمة الحقيقية، نقل HTTP محدود المدة وإعادة المحاولة، قراءة EPUB آمنة، استخراج الفصول، تحقق الغلاف، بناء المؤلف/العمل/الكتاب/الطبعة، والنشر الذري المشروط. |
| `scripts/catalog-ingest.ts` | نقطة التشغيل `npm run catalog:ingest`؛ تتطلب MongoDB وتمنع التخزين المحلي عندما تكون `NODE_ENV=production`. |
| `server/db/migrations.ts` | ترحيل P15: مصدر `StandardEbooks` في وظائف الإدخال وcollection `catalog_assets` لسجل الغلاف المحفوظ وبصمته ومصدره. |
| `server/security/FileUploadSecurity.ts` | تصحيح دقيق لفاحص EPUB كي يقبل مجلدات ZIP الشرعية مثل `META-INF/`، من دون السماح بمسارات فارغة أو متجاوزة. |
| `tests/p15.real-catalog-ingestion.test.ts` | اختبار عزل MongoDB يثبت الحفظ، وإعادة التشغيل الآمنة، وحجب الحقوق الغائبة والـEPUB الفاسد. |
| `scripts/p15-live-catalog-smoke.ts` | اختبار حي معزول يشغل أمر ingest ذاته ضد الكتب الثلاثة من المصدر الرسمي. |
| `scripts/run-p15-real-catalog-gate.sh` | بوابة موحدة تشمل type-check والبناء والاختبارين. |

## 3. قواعد الجودة والتنفيذ

| القاعدة | الدليل المطلوب قبل النشر | سلوك الفشل |
|---|---|---|
| **metadata مكتملة** | manifest مراجع يدوياً يحوي العنوان والمؤلف والوصف والتصنيف والسنة وروابط المصدر والغلاف والإسناد. | Job محجوبة ولا ينشأ كتاب منشور. |
| **rights موثقة** | صفحة المصدر تتضمن تصريح الحقوق الأميركي، وسجل حقوق دائم يحوي النوع والدليل والإقليم والمصدر والإسناد ووقت التحقق. | الحالة `BLOCKED`؛ لا يكتب كتاباً. |
| **source موثوق** | جميع الصفحة والـEPUB والغلاف محصورة في HTTPS داخل `standardebooks.org` أو `www.standardebooks.org`؛ مصدر النسخة GitHub HTTPS. | Job مرفوض عند رابط غير معتمد أو إعادة توجيه خارج الحدود. |
| **file موجود وسليم** | ملف EPUB ثنائي غير فارغ ضمن الحد، ZIP/EPUB آمن، نتيجة `contentInspection: PASSED`، وSHA-256 متطابق بعد التخزين. | Job محجوبة؛ لا يتحول السجل إلى `PUBLISHED`. |
| **chapters قابلة للقراءة** | `container.xml` وOPF وspine صالحة، وفصلان على الأقل بكل منهما 160 حرفاً نصياً أو أكثر. | Job محجوبة؛ لا ينشر نصاً غير قابل للقارئ. |
| **cover موثق** | غلاف المصدر سليم، وcover مضمّن في EPUB موجود، وتُخزن نسخة الغلاف في storage مع SHA-256 وسجل `catalog_assets`. | Job محجوبة؛ لا ينشر سجل بلا غلاف موثق. |

تستخدم عملية الاستيعاب user-agent تشغيلياً واضحاً، وزمن انتظار محدوداً، وإعادة محاولة واحدة فقط، وتأخير 1.5 ثانية بين الكتب. كما تتبع رابط EPUB النهائي الذي تعلنه صفحة التنزيل نفسها. تبيّن سياسة robots للمصدر قيوداً على مسارات التنزيل لبعض زواحف SEO وAI المسماة؛ ولا تحول هذه العملية إلى زاحف عام أو مجمّع bulk، بل تبقي القائمة يدوية صغيرة ومراجعة مع كل تشغيل.[6]

## 4. تخزين الكتالوج الناتج

| البيانات | التخزين الدائم |
|---|---|
| المؤلف والعمل والكتاب والطبعة | `authors` و`works` و`books` و`editions`، مع `workflowStatus: PUBLISHED` بعد اجتياز البوابة فقط. |
| الفصول المقروءة | `chapters` ونسخة القراءة الخفيفة في إسقاط الكتاب. |
| EPUB والـchecksum | `book_files` مع `format: EPUB` و`checksum` و`verifiedAt` و`contentInspection: PASSED`، والبايتات في object storage. |
| الحقوق | `rights_records`؛ سجل واحد حالي لكل كتاب/طبعة وإقليم `US`. |
| الغلاف | bytes في object storage وسجل `catalog_assets` يتضمن المصدر وMIME والحجم وSHA-256. |
| سلسلة الأدلة | `ingestion_jobs`، بما في ذلك metadata والحقوق ومصدر الملف والبصمة وعدد الفصول والغلاف وحالة النشر. |

## 5. تشغيل الإنتاج

في بيئة الإنتاج، لا يمكن تشغيل الاستيعاب بتخزين محلي. يجب أولاً تهيئة MongoDB وS3-compatible storage، ثم تشغيل الترحيل والاستيعاب. تظل عملية `--dry-run` مفيدة للتحقق من المصدر والحقوق والملف والفصول **من دون** نشر البيانات.

```bash
export MONGODB_URI='mongodb://…'
export MONGODB_DB_NAME='nexara'
export NODE_ENV='production'
export BOOK_STORAGE_PROVIDER='s3'
export BOOK_STORAGE_BUCKET='…'
export BOOK_STORAGE_ENDPOINT='https://…'
export BOOK_STORAGE_ACCESS_KEY='…'
export BOOK_STORAGE_SECRET_KEY='…'

npm run db:migrate
npm run catalog:ingest
```

للتدقيق بلا كتابة:

```bash
npm run catalog:ingest -- --dry-run
```

إذا كانت السياسة تتطلب فحص برمجيات خبيثة، يجب ضبط `BOOK_REQUIRE_MALWARE_SCAN=true` و`BOOK_MALWARE_SCANNER=clamdscan`؛ عندئذ يرفض الأمر التشغيل إن لم يكن الماسح متاحاً.

## 6. نتيجة التحقق

اجتازت بوابة P15 عند `2026-08-18T16:34:27Z`. اختبرت البوابة فحص النوع وبناء الإنتاج وقواعد الرفض في MongoDB مؤقتة، ثم استدعت أمر الاستيعاب ذاته ضد المصدر الحي. أسفر الفحص الحي عن **3 كتب منشورة، 3 ملفات EPUB موثقة، 3 سجلات حقوق موثقة، 115 فصلاً مقروءاً، و3 أصول أغلفة**.[2]

> **حد التقرير:** هذه النتيجة تثبت اكتساب الكتب الحقيقية من المصدر الحي وحفظها داخل MongoDB وobject storage مؤقتين معزولين. لم تُرحّل أي بيانات إلى MongoDB أو S3 إنتاجيين للمستخدم لأن بيانات تلك البيئة لم تُوفر لهذه الجلسة. أمر `catalog:ingest` هو المسار الجاهز لذلك بعد ضبط متغيرات الإنتاج أعلاه.

## 7. أوامر التحقق

```bash
npm run test:p15
npm run test:p15:live
npm run test:p15:gate
```

كما أُدرجت بوابة P15 في `scripts/run-all-acceptance-audit.sh` ليصبح المسار الموحد للمستودع من P0 حتى P15. أُعيد تشغيل هذا المسار بعد إصلاح تسمية manifest P15 المتوافقة مع بوابة P1، وانتهى رسمياً بـ`Summary: PASS P0-P15` عند `2026-08-18T16:41:09Z`.[7]

## المراجع

[1]: https://standardebooks.org/ "Standard Ebooks — Free and liberated ebooks"  
[2]: ../artifacts/audit/p15-real-catalog-gate.log "سجل بوابة P15"  
[3]: https://standardebooks.org/ebooks/jane-austen/pride-and-prejudice "Pride and Prejudice — Standard Ebooks"  
[4]: https://standardebooks.org/ebooks/mary-shelley/frankenstein "Frankenstein — Standard Ebooks"  
[5]: https://standardebooks.org/ebooks/oscar-wilde/the-picture-of-dorian-gray "The Picture of Dorian Gray — Standard Ebooks"  
[6]: https://standardebooks.org/robots.txt "Standard Ebooks robots.txt"  
[7]: ../artifacts/audit/p0-p15-execution.log "سجل القبول الشامل P0–P15"  
