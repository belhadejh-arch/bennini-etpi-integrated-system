# BENNINI ETPI Integrated System

وثيقة المواصفات التقنية والدليل الإرشادي الشامل لتصميم وتطوير النظام
المتكامل لشركة BENNINI ETPI (أشغال عمومية وصناعية) بناءً على شعار الشركة

والمبادئ التوجيهية للواجهات المرفقة.

🎨 الهوية البصرية ونظام التصميم (UI/UX Design System)

1. لوحة الألوان (Color Palette)
   تم اعتماد الألوان المحددة لتعكس الطابع الاحترافي والهندسي لشركة الأشغال العمومية:

- Dark Navy / Background Core (#07152f): الخلفيات الداكنة وشريط التصفح الجانبي (Sidebar).
- Primary Deep Blue (#083c7a & #05326f): العناصر الرئيسية، الأزرار الإدارية، ورؤوس الجداول.
- Accent Royal Blue (#0555a8): الأزرار النشطة (Active States) والتفاعل (Hover Effects).
- Secondary Slate Blue (#66839e & #7fa9c7): النصوص الثانوية، الحدود (Borders)، والأيقونات غير النشطة.
- Primary Brand Yellow (#f5b41e): التمييز (Highlights)، التنبيهات، الأزرار التفاعلية الهامة (CTA)، وأرقام الإحصائيات.
- Soft Cream / Light Gold (#e4d69a): الخلفيات الخفيفة للتنبيهات أو بطاقات التلخيص.

2. الخطوط والعناصر البصرية (Typography & Assets)

- خط العناوين والنصوص: Changa (مع استخدام أوزان مختلفة: Light, Regular, Semi-Bold, Bold).
- شعار الشركة (Header Logo): يُدرج شعار BENNINI ETPI في أعلى الشريط الجانبي (Sidebar Header) وفي الهيدر الرئيسي للوحة التحكم وبوابة دخول المستخدمين.
- أسلوب الواجهات:
  - اعتماد البطاقات ذات الزوايا المنحنية (Rounded Cards - border-radius: 12px إلى 16px).
  - استخدام ظلال خفيفة ناعمة (Soft Drop Shadows) لتمييز العناصر فوق الخلفية البيضاء أو الرمادية الفاتحة #F8FAFC.
  - القائمة الجانبية بتصميم ملون وأيقونات واضحة مع إشارة خلفية منحنية للشريحة النشطة (مستوحى من تصميم الواجهة المرفقة).
    🏗️ الهيكلية العامة للنظام (Architecture)
    يتكون النظام من منصتين رئيسيتين مرتبطة بقاعدة بيانات موحدة وسريعة المزامنة:
- المنصة الرئيسية (Web Dashboard - للكمبيوتر):
  - موجهة للمدير العام، الإدارة الماليّة، والمشرفين.
  - تحتوي على تقارير شاملة، رسومات بيانية، وإدارة الصلاحيات والمستخدمين.
- تطبيق الهاتف/بوابة المستخدمين (Mobile / Web WebApp):
  - واجهة مبسطة ومناسبة للهواتف الذكية لرؤساء الأشغال والعمال في الميدان.
  - تتيح الإدخال السريع مع خيار رفع الصور وإرسال الملاحظات والمزامنة الفورية.
    📋 تفاصيل الأقسام والوظائف (System Modules)

1. لوحة التحكم الرئيسية (Dashboard)

- ترحيب شخصي: بطاقة ملخصة أعلى الشاشة برسم إيضاحي ومؤشرات سريعة (مثل حالة الطقس للمشاريع الميدانية أو تنبيهات اليوم).
- بطاقات الإحصائيات (KPI Cards):
  - الرصيد الحالي الصافي.
  - إجمالي المشتريات والربح المتوقع/المحقق.
  - الشيكات قيد الانتظار.
  - عقود الكراء النشطة والتنبيهات.
- رسومات بيانية تفاعلية: تحليل التدفقات المالية والمبيعات الأسبوعية/الشهرية.

2. التسيير المالي (Financial Management) 💰
   جدول ديناميكي يدعم التصفية حسب التاريخ والجهة:

- الحقول: (نوع العملية: دخل / خرج | المبلغ | المصدر / الجهة المستفيدة | سبب العملية | التاريخ | طريقة الدفع: نقداً / شيك / تحويل | المبلغ المتبقي في الصندوق | المرفقات: وصل / فاتورة).
- حساب آلي: تحديث الرصيد المتبقي في الصندوق تلقائياً بعد كل عملية.

3. المشتريات والسلع والمخزون (Procurement & Inventory) 📦

- سجل الشراء: (اسم السلعة | الكمية | سعر الشراء | إجمالي التكلفة | المورد | رقم الفاتورة | تاريخ الشراء | سعر البيع | قيمة الربح المتوقعة | الربح المحقق | الكمية المتبقية).
- مثال الحساب الآلي:
  - شراء 100 قطعة × 500 دج = 50,000 دج.
  - البيع 100 قطعة × 700 دج = 70,000 دج.
  - الربح = 20,000 دج.
- تنبيه المخزون: إشعار عند اقتراب كمية سلعة معينة من النفاد.

4. إدارة الشيكات (Cheque Management) 🧾

- الحقول: (رقم الشيك | رقم الفاتورة المرتبطة | المبلغ | المستفيد | البنك | تاريخ الإصدار | تاريخ الاستحقاق | حالة الشيك: قيد الانتظار / مدفوع / ملغى | ملاحظات | صورة الشيك/الفاتورة).
- ميزة البحث السريع: شريط بحث علوي خاص للوصول الفوري عبر رقم الشيك أو رقم الفاتورة.

5. قسم الكراء والآليات (Rental Management) 🏗️

- الحقول: (الشيء المؤجر | اسم المستأجر/المؤجر | تاريخ البداية | تاريخ النهاية | المدة | السعر اليومي/الشهري | المبلغ الإجمالي | المدفوع | المتبقي | حالة الكراء | العقد المرفق).

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a369290c-cf18-42c3-aa58-b7a0fab29ccb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm ci
npm run dev
```

## النشر على Vercel وRender

تُستضاف واجهة TanStack Start على Vercel، وتُستضاف خدمة API الموثوقة على Render. تبقى بيانات التطبيق في قاعدة Cloud Firestore الحالية؛ لا يُنشأ أو يُنقل أي مخطط PostgreSQL. خدمة Render الحالية مخصصة للتحقق من حساب المدير ومنحه الصلاحية، بينما تتصل وحدات التطبيق الحالية بـFirestore مباشرة من المتصفح. نقل عمليات البيانات كلها إلى Render يحتاج عملاً منفصلاً.

### Vercel — الواجهة

1. استورد المستودع إلى Vercel واختر إعداد `TanStack Start` (المحدد أيضاً في `vercel.json`).
2. أمر البناء: `npm run build:vercel`. أمر التثبيت: `npm ci`.
3. بعد إنشاء خدمة Render، أضف متغير البيئة `VITE_API_BASE_URL` بقيمة عنوان Render الأساسي، مثل `https://your-render-api.onrender.com`، ثم أعد النشر.
4. أضف نطاق Vercel إلى النطاقات المصرح بها في Firebase Authentication، وفعّل Google كمزوّد تسجيل دخول.

### Render — API

1. أنشئ Web Service من هذا المستودع باستخدام مخطط `render.yaml`.
2. أمر البناء: `npm ci`. أمر التشغيل: `npm run start:api`. فحص الصحة: `/health`.
3. أضف المتغيرات التالية من لوحة Render:
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: JSON حساب خدمة Firebase للمشروع نفسه. احفظه كمتغير سري في Render فقط ولا تضعه في المستودع أو Vercel.
   - `ADMIN_EMAIL`: البريد الموثّق الذي تريد منحه دور المدير.
   - `FRONTEND_ORIGINS`: نطاق واجهة Vercel الدقيق، بلا مسار؛ يمكن إضافة نطاقات مفصولة بفواصل.
   - `FIREBASE_DATABASE_ID`: معرف قاعدة Firestore ذات الاسم المخصص. قيمة قاعدة المشروع موجودة في `firebase-applet-config.json` ومعبأة في `render.yaml`.
4. في Firebase Console، فعّل تسجيل الدخول عبر Google وأضف نطاق Vercel إلى Authorized domains. انشر محتوى `firestore.rules` على قاعدة Firestore ذات المعرف أعلاه.
5. سجّل الدخول في الواجهة بحساب Google الذي يطابق `ADMIN_EMAIL`. عند أول تسجيل دخول موثّق، يمنحه Render مطالبة `role=admin` ويُنشئ ملفه في `userProfiles`. سجّل الخروج ثم الدخول مجدداً إذا لم يظهر الدور مباشرة.

### التشغيل محلياً

```sh
npm ci
npm run dev
```

لتجربة API محلياً، شغّل في نافذة طرفية ثانية:

```sh
npm run dev:api
```

وعرّف `VITE_API_BASE_URL`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_DATABASE_ID`, `ADMIN_EMAIL`, و`FRONTEND_ORIGINS` في بيئة التطوير المناسبة. لا تضع بيانات حساب الخدمة في `.env` مرفوع إلى Git.
