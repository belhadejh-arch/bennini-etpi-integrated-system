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

Configure the `NEON_DATABASE_URL` and `SESSION_SECRET` environment secrets before starting the server. Set a high-entropy `ADMIN_BOOTSTRAP_TOKEN` secret for one-time administrator setup. The first administrator uses that token at the setup screen; the app creates a six-digit serial and displays it once. Administrators create all later member accounts and serials from the members dashboard.

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
