# Nexara Documentation Index

يحتوي هذا المجلد على **الوثائق المرجعية الحالية فقط**. أزيلت مسودات المراحل القديمة، والسجلات الآلية، والتقارير المتجاوزة، ولقطات المتصفح؛ إذ إن قيمتها تاريخية ولا ينبغي أن تنافس المرجع النهائي عند تشغيل المشروع أو صيانته.

| الوثيقة | الغرض | متى تُقرأ |
|---|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | البنية العامة، طبقات الخادم، نموذج المجال، وقواعد التصميم. | قبل تعديل البنية أو التخزين أو الخدمة. |
| [`API.md`](./API.md) | عقد واجهة API والمسارات الرئيسية. | قبل تعديل عميل API أو المعالجات أو التكاملات. |
| [`PHASE_P6_BOOK_DOWNLOAD_SYSTEM_REPORT_AR.md`](./PHASE_P6_BOOK_DOWNLOAD_SYSTEM_REPORT_AR.md) | نموذج تنزيل الكتب، التحقق من الحقوق، والتعامل مع الأعطال. | قبل تعديل التنزيل أو إتاحة المحتوى. |
| [`PHASE_P7_API_NETWORK_RELIABILITY_REPORT_AR.md`](./PHASE_P7_API_NETWORK_RELIABILITY_REPORT_AR.md) | سياسة موثوقية API والشبكة، المهلات، وإعادة المحاولة والعزل. | قبل تعديل طلبات المصادر الخارجية أو API client. |
| [`PHASE_P8_AUTHENTICATION_AUTHORIZATION_REPORT_AR.md`](./PHASE_P8_AUTHENTICATION_AUTHORIZATION_REPORT_AR.md) | المصادقة والأدوار والصلاحيات وملكية الموارد. | قبل تعديل الهوية أو التفويض. |
| [`PHASE_P9_SECURITY_HARDENING_REPORT_AR.md`](./PHASE_P9_SECURITY_HARDENING_REPORT_AR.md) | خط أساس الأمان: رفع الملفات، CORS/CSRF، SSRF، الرؤوس، وحدود الطلبات. | قبل تغيير مسارات الحساسة أو التخزين أو التنزيل. |
| [`PHASE_P10_FRONTEND_ARCHITECTURE_UX_QUALITY_REPORT_AR.md`](./PHASE_P10_FRONTEND_ARCHITECTURE_UX_QUALITY_REPORT_AR.md) | مسارات الواجهة، الروابط العميقة، الحوارات، الإتاحة، وحالات التجربة. | قبل تعديل التنقل أو الحوارات أو واجهة المكتبة. |
| [`PHASE_P11_REAL_REVIEWS_COMMUNITY_PERSONALIZATION_REPORT_AR.md`](./PHASE_P11_REAL_REVIEWS_COMMUNITY_PERSONALIZATION_REPORT_AR.md) | مراجعات المجتمع الدائمة، الإعجابات، النقاشات، تاريخ القراءة، وواجهة مكتبة بلا تخصيص ثابت مضلل. | قبل تعديل المجتمع أو بيانات المستخدم أو الرفوف أو سجل القراءة. |
| [`PHASE_P12_OBSERVABILITY_OPERATIONS_REPORT_AR.md`](./PHASE_P12_OBSERVABILITY_OPERATIONS_REPORT_AR.md) | سجل منظم، request ID، أحداث التنزيل والأخطاء، وواجهات liveness/readiness الحقيقية. | قبل تعديل التشغيل أو التبعيات أو health endpoints أو سياسة السجلات. |
| [`PHASE_P13_PERFORMANCE_ENGINEERING_REPORT_AR.md`](./PHASE_P13_PERFORMANCE_ENGINEERING_REPORT_AR.md) | خط أساس أداء فعلي، مقارنة قبل/بعد، وتحسينات P13 المبررة بالقياس فقط. | قبل تغيير الحزمة أو القارئ أو API أو MongoDB أو استراتيجية التخزين المؤقت. |
| [`PHASE_P14_TESTING_MASTER_GATE_REPORT_AR.md`](./PHASE_P14_TESTING_MASTER_GATE_REPORT_AR.md) | بوابة الاختبارات الرئيسية: طبقات الوحدة والتكامل وE2E المنظومي، وأوامر إعادة التنفيذ وأدلة القبول. | قبل تعديل قواعد العمل أو API أو الملفات أو المصادقة أو مسارات القارئ والنشر. |
| [`PHASE_P15_DATA_MIGRATION_REAL_INITIAL_CATALOG_REPORT_AR.md`](./PHASE_P15_DATA_MIGRATION_REAL_INITIAL_CATALOG_REPORT_AR.md) | ترحيل كتالوج أولي حقيقي، مصدر معتمد، حقوق إقليمية، EPUBs موثقة، أغلفة وفصول، وقواعد رفض النشر. | قبل تعديل قائمة الكتب أو مصادر الإدخال أو التخزين أو سياسة الحقوق أو نشر الكتالوج. |
| [`FINAL_INDEPENDENT_ACCEPTANCE_AUDIT_P0_P10_AR.md`](./FINAL_INDEPENDENT_ACCEPTANCE_AUDIT_P0_P10_AR.md) | سجل قبول تاريخي للمراحل P0–P10 قبل إضافة P11–P13. | للرجوع إلى سياق الإصلاحات السابقة فقط. |
| [`FINAL_INDEPENDENT_ACCEPTANCE_AUDIT_P0_P13_AR.md`](./FINAL_INDEPENDENT_ACCEPTANCE_AUDIT_P0_P13_AR.md) | تدقيق تاريخي للمراحل P0–P13 قبل P14 وP15. | للرجوع إلى سياق الإصلاحات السابقة فقط. |
| [`FINAL_INDEPENDENT_ACCEPTANCE_AUDIT_P0_P15_AR.md`](./FINAL_INDEPENDENT_ACCEPTANCE_AUDIT_P0_P15_AR.md) | قرار التدقيق المستقل الأحدث P0–P15، إعادة تنفيذ البوابات، إصلاحات التدقيق، وحدود التكامل الحي. | قبل التسليم أو النشر أو الادعاء باكتمال الخدمة. |

> **سياسة التوثيق:** أضف وثيقة جديدة فقط عند وجود مرجع تشغيلي دائم أو قرار معماري طويل الأثر. ضع سجلات الاختبارات ولقطات المتصفح وملفات القياس في مخرجات CI أو artefacts الإصدار، لا في `docs`.
