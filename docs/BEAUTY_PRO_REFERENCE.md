# نظام Beauty Pro (AIHELPS) — المرجع التقني الشامل الموحّد
## توثيق كامل: التحليل الوظيفي، تدفق البيانات، قواعد العمل، السيناريوهات الاستثنائية، التقييم، وفرص الذكاء الاصطناعي

> هاد الملف يجمع بمكان واحد كل التحليل الذي أُنجز لنظام Beauty Pro عبر سلسلة كاملة من لقطات الشاشة (~200 صورة) تغطي كل موديولات النظام، إعداداته، وتقاريره. مقسّم لـ6 أقسام رئيسية، كل قسم كان أصلًا ملفًا مستقلًا.

---

## فهرس المحتويات

| # | القسم | المحتوى |
|---|---|---|
| 1 | **التحليل الشامل للنظام** | شرح وظيفة كل موديول وكل شاشة والهدف منه |
| 2 | **خريطة الترابط وتدفق البيانات** | كيف تنتقل البيانات بين الموديولات + سيناريوهات End-to-End |
| 3 | **قواعد العمل الكاملة** | ~40 قاعدة عمل صريحة وضمنية مع دليل كل استنتاج |
| 4 | **السيناريوهات الاستثنائية** | الإلغاء، التعديل، الحذف، التراجع، المرتجعات، الدفع/التسليم الجزئي، الأخطاء |
| 5 | **التقييم الشامل (SWOT)** | نقاط القوة/الضعف/المخاطر/فرص التطوير + تقييم كمي ومقارنة مع Odoo |
| 6 | **أفكار دمج الذكاء الاصطناعي** | +30 فكرة عملية مبنية على ميزات النظام الفعلية |

---

<div style="page-break-after: always;"></div>

-e 

# ═══════════════════════════════════════════
# القسم 1: التحليل الشامل للنظام
# ═══════════════════════════════════════════

# التحليل الشامل النهائي لنظام Beauty Pro (AIHELPS)
## توثيق تقني كامل — وظيفة كل شاشة وكل قسم والهدف منه

> هاد التوثيق يجمّع ويلخّص كل ما تم تحليله عبر سلسلة كاملة من لقطات الشاشة (حوالي 200 صورة) غطّت النظام بأكمله: الإعداد الأولي، كل الموديولات الرئيسية، شجرة الإعدادات الخماسية، وشجرة التقارير. الهدف: مرجع تقني واحد يشرح **وظيفة كل شاشة** و**سبب وجودها** ضمن منظومة العمل الكاملة.

---

# 1. الفكرة العامة للنظام

**Beauty Pro** هو نظام **CRM + ERP + POS** متكامل لصالونات التجميل/الحلاقة/السبا، من شركة **AIHELPS** الأوكرانية (منتشرة بـ24 دولة، أكثر من 3000 صالون). نموذج العمل: اشتراك شهري (SaaS) بعدة باقات (Light/Standard/Ultimate)، مع نسخة Demo لـ7 أيام.

المعمارية الكلية مبنية على **6 محاور مترابطة**:
1. **نظام الأدوار (Roles)**: كل موظف له Role رئيسي + أدوار إضافية (Multi-role)، وتتحكم بالصلاحيات والراتب والظهور بالتقارير.
2. **نظام Multi-location**: قاعدة بيانات واحدة تدعم فروع متعددة، بإعدادات عامة (Program) وإعدادات خاصة بكل فرع (Location).
3. **نظام الحسابات الثلاثي**: Bank account / Cash drawer / Safe — كل حركة مالية بالنظام تمر عبر أحدها.
4. **نظام Payment Plans**: محرك معادلات رواتب وعمولات مرن (Percent Plan / Graduated commission) قابل للتخصيص لكل موظف ولكل خدمة.
5. **نظام الصلاحيات (RBAC)**: شجرة صلاحيات دقيقة تُمنح لكل Role، تتحكم بكل زر وكل حقل بالنظام.
6. **مكونات عامة قابلة لإعادة الاستخدام**: نفس الأنماط (Graduated commission، Awards/Fines، Folder trees، Drag & Drop) تتكرر بأكثر من موديول — دليل على معمارية Backend نظيفة.

---

# 2. عملية الإعداد الأولي (Onboarding)

## 2.1 شاشة "Load program"
**الوظيفة:** تسجيل أول مستخدم بقاعدة البيانات (Name, Last name, Phone, E-mail, Password).
**الهدف:** هاد المستخدم يصبح تلقائيًا **"database owner"** — صاحب الصلاحيات الكاملة والحساب المسؤول عن الاشتراك.

## 2.2 شاشة "Demo mode"
**الوظيفة:** عداد أيام تجريبية (7 أيام) + حقل كود تفعيل.
**الهدف:** السماح بتجربة النظام كاملًا قبل الاشتراك المدفوع.

## 2.3 Main Setup Wizard (6 خطوات)
- **Start**: ترحيب.
- **Appointment book**: تحديد ساعات عمل المنشأة العامة (الأساس الذي تُبنى عليه ساعات كل فرع لاحقًا).
- **Type of business**: اختيار قطاع/قطاعات العمل (Hairdressing, Barbershop, Cosmetology, Nail services, Makeup, Massage, Tanning bed) — **هاي نفسها لاحقًا "Departments"** بموديول Settings، وتتحكم بأي خدمات مبدئية تُزرع بالنظام.
- **Services**: شجرة خدمات مُعرّفة مسبقًا (Seeded) حسب القطاعات المختارة، قابلة للتحديد بـcheckbox.
- **Employees**: إدخال أول دفعة موظفين (Name, Role, Work schedule بـ3 أنماط: By day of week / Even-Odd / X days in Y days).
- **Complete the setup**: شاشة ختامية تُذكّر بإعدادات لاحقة (Online booking, Loyalty, Salary, Products, Telephony).

**الهدف الكلي من الـWizard:** تجهيز قاعدة بيانات صالحة للعمل فورًا بدل شاشة فارغة، وتوجيه المستخدم الجديد خطوة بخطوة.

---

# 3. موديول Private Office

**الوظيفة:** حساب/اشتراك صاحب النظام (منفصل عن اسم المستخدم الشخصي، ويحمل اسم قاعدة البيانات: "Greetings, [Name]!").
**العناصر:**
- **Balance + History**: رصيد الاشتراك وسجل الدفعات.
- **New payment**: اختيار Payment plan، Period slider (1-12 شهر)، سعر شهري €50، اشتراك سنوي €500 (خصم €100)، كود خصم، دفع ببطاقة.
- **Support**: قنوات الدعم الفني (Sales manager, Chat, Email, Phone).

**ملاحظة معمارية:** أسعار الاشتراك باليورو، **منفصلة تمامًا** عن عملة تشغيل الصالون (₪) — النظام مصمم بشكل SaaS عالمي بغض النظر عن سوق التشغيل المحلي.

---

# 4. موديول Clients

## 4.1 الشاشة الرئيسية
**الوظيفة:** إدارة قاعدة بيانات الزبائن كاملة.
- **Toolbar**: New/Edit client، Quick sale، At the salon now، Add to balance، Remove credit، **Companies** (دعم زبائن B2B/اعتباريين).
- **بحث موحّد**: بالاسم/الهاتف/رقم البطاقة.
- **Check-in log**: سجل حضور مرتبط بقارئ بطاقات/بصمة محتمل (Employees + Clients، Enter/Card number/Visits).

## 4.2 نافذة "Add client"
كل حقل له غرض دقيق:
- **أساسية**: Photo, Name/Last name, Gender, **Category** (Multi-category: زبون يقدر يكون بأكثر من فئة بنفس الوقت — Black list, Family/friends, VIP، وقابلة للإضافة).
- **تواصل**: Phone, E-mail (+ Do not send E-mail), Facebook/Viber/Instagram.
- **ديموغرافي/تسويقي**: Birthday (لحساب Age تلقائيًا)، **Client acquisition source** (مصدر معرفة الزبون بالصالون، قابل للتخصيص من Marketing→Client acquisition sources)، **UTM Campaign/Source/Medium** (تتبع حملات رقمية احترافي).
- **مالي**: Card number، **Maximum debt total** (سقف الدين، يتقاطع مع صلاحية RBAC "Changing of maximum debt amount" وسقف "Maximum discount" العام بـSettings).
- **علاقات**: **Professional / Manager / Service manager** — 3 أدوار مبيعات منفصلة تحدد توزيع البونصات (الجواب الكامل موجود بقسم Payment Plans → Sale bonuses).
- **عنوان وهوية**: Mailing address، Passport، Identification code (نفس نمط بيانات الموظف).

## 4.3 نظام Client Categories
**الوظيفة:** فلترة/تصنيف الزبائن لأغراض تسويقية (Bulk SMS، تقارير، منع الحجز الأونلاين لفئة "Black list" مثلًا عبر Online booking settings).
**"Automatic assignment category clients"**: قواعد تلقائية لتصنيف الزبون حسب شروط (Trigger-based، نفس منطق Marketing→Promotions→Trigger).

## 4.4 ملف الزبون (4 تبويبات)
- **Information**: ملخص + Balance + **"Relatives and friends"** (ربط زبون بزبون آخر).
- **History**: سجل الزيارات الكامل (Date, Payment, Professional, Bonus, Gift certificate...) — المصدر الأساسي لتقارير "Client's visits".
- **Cards**: باقات مسبقة الدفع مرتبطة بالزبون (مختلفة عن "Card number" الفيزيائية).
- **Files**: مرفقات بالسحب والإفلات (Drag & Drop) — نفس آلية موديول Documents.

**أزرار إدارية:** "To archive" (Soft delete)، "Merge client" (دمج مكررين، يظهر بتقرير "Duplicate clients").

**حالة الزبون التلقائية:** potential (بدون زيارات) / active / former (بعد فترة غياب محددة بـSettings) / one-time — تُستخدم بكل رسائل الإشعارات التلقائية (Birthday greetings مثلًا).

## 4.5 النظام المالي للزبون (Balance)
**Add to balance** (شحن مسبق) و**Remove credit** (استهلاك دَين حتى Maximum debt) — كلاهما يمران عبر **Cash drawer** إجباريًا، ويظهران أيضًا كأزرار مباشرة بموديول Cash per day (نفس الـDialog من نقطتي دخول).

---

# 5. عملية البيع — شاشة Ticket (Quick Sale)

**الوظيفة:** الشاشة المركزية لكل عمليات البيع (خدمات، منتجات، كروت، شهادات).
**اكتشاف مهم:** حتى **الموظفين أنفسهم يظهرون بقائمة العملاء** كـ"(employee) Name" — لأن النظام يسمح للموظف بشراء خدمة/منتج لنفسه، بتسعير خاص يُدار من Settings→Sales→Employees sales.

---

# 6. موديول Products

**الوظيفة:** إدارة المخزون الكامل (منتجات للبيع + Backbar للاستهلاك الداخلي).
- **Storages**: مخازن متعددة، كل واحد له "Financially responsible" (مسؤول مالي) — يدعم Multi-branch inventory.
- يرتبط بشجرة تقارير ضخمة: List/Sales/Profitability/Stock count/Low supply/Suppliers/Payments to suppliers/Write-off/Return to supplier.
- **Backbar**: مفهوم أساسي بحساب الرواتب (Payment Plans) وتقارير الربحية.

---

# 7. موديول Services / Groups

**الوظيفة:** كتالوج الخدمات الهرمي (Category→Sub-service) و**Groups** (جلسات جماعية، دروس بمجموعة — Group lessons).
- **Service color**: لون كل خدمة، يظهر بـAppointment book.
- **Groups**: لها تقارير خاصة (Group sales and group cards، Replace professional، Average number of clients in group) — تدعم استبدال المدرّب/الأخصائي بمنتصف دورة.

---

# 8. موديول Employees

## 8.1 بيانات الموظف الأساسية
- **Folder** (Role رئيسي) + **"Additionally"** (Multi-role — نفس الموظف ممكن يحمل أكثر من دور).
- **Work schedule بمستويين**: عام + جدول تفصيلي **لكل Location على حدة** (Location | Work schedule | Starting with) — يؤكد استقلالية جدول الدوام بين الفروع.
- **Program language**: لغة واجهة مستقلة لكل موظف.
- **☑ "Has access to the program from mobile application"**.
- **Contract**: بيانات العقد القانونية.
- **"Merge with employee"**: دمج سجلات مكررة.

## 8.2 Send invitations to the program
إرسال دعوة تسجيل دخول تلقائية بالإيميل، مقسّمة حسب Role.

## 8.3 Schedule for month
جدول شهري بالألوان (رمادي=عطلة، أخضر=أول يوم، بنفسجي=عادي، وردي=**"Fact"**=حضور فعلي مسجّل عبر قارئ البصمة/البطاقة) — يربط Check-in log بالمخطط النظري.

## 8.4 Work schedules (Presets)
قوالب دوام جاهزة (2 days in 2 days, Mon-Sat...) قابلة لإعادة الاستخدام لأي موظف.

## 8.5 Payment Plans — محرك الرواتب
**Percent Plan**: بناء معادلة راتب بتركيب Checkboxes (% من full/discounted total، % of price/cost، إضافات ثابتة ₪/ساعة/دقيقة) + **"Formula preview"** نصي تلقائي.
**Graduated commission**: عمولة متدرجة حسب حجم المبيعات (شرائح From-to)، مع **"Is calculated from" / "Affects on"** منفصلين — نفس المكوّن يتكرر لاحقًا بـMarketing→Accumulative card وSettings→Graduated commission discount العام.

## 8.6 "Payment" (مصفوفة التطبيق)
كل خدمة × كل موظف → خطة راتب مختلفة قابلة للتخصيص لكل خلية.

## 8.7 Sale bonuses
4 أعمدة بونص منفصلة عن الراتب الأساسي: **For administrator** / **To manager** / **To Service manager** / **For recommendation** — هاد يفسّر أدوار Manager/Service manager/Professional المرتبطة بالزبون (قسم 4.2).

## 8.8 Access Rights (RBAC)
شجرة صلاحيات ضخمة مقسّمة حسب كل موديول بالنظام، بما فيها صلاحيات حساسة منفصلة (View/edit purchase prices، Manual payroll at sale، Cancel receipts، Correction of data for past days) وصلاحيات Mobile app منفصلة.

---

# 9. موديول Appointment Book

**الوظيفة:** الكاليندر الرئيسي للحجوزات.
- أعمدة = موظفين (بالـRole فوق الاسم) + عمود "Waiting list".
- صفوف = وقت، بخط أفقي للوقت الحالي.
- ألوان الخدمات من "Service color".
- **"Appointments... marked as important"** (Settings→Sales) و**Zones and halls** (Location settings) يضيفان بُعد "المكان الفيزيائي" كمورد إضافي يجب التحقق من توفره جنبًا إلى جنب مع توفر الموظف.

---

# 10. موديول Calls

**الوظيفة:** إدارة الاتصالات ونظام "Manager" (مدير علاقة الزبون).
- **Manager + "Change manager"**: هون بالضبط يُدار حقل الـ"Manager" المرتبط بالزبون (قسم 4.2) وبونص "To manager" (قسم 8.7).
- **تبويب Today**: سجل يومي (Time/Client/Phone/Status/Text) + خيار توسيع لعرض كل المكالمات والزيارات القادمة.
- **Incoming call**: يعتمد على تفعيل Telephony (Settings) لتفعيل Caller ID تلقائي.

---

# 11. موديول Marketing

## 11.1 Birthdays
عرض أعياد ميلاد الزبائن/الموظفين القادمة.

## 11.2 Cards
**تعريف** أنواع الكروت (Templates)، بخمسة أنواع:
- **Discount card**: خصم دائم %.
- **Bonus card**: نظام نقاط ولاء بنسب منفصلة لكل فئة منتج.
- **Subscription to service**: اشتراك محدد بخدمة واحدة (Professional's bonus خاص).
- **Accumulative card**: خصم/بونص متدرج (Graduated commission).
- **Detailed card**: نوع خامس متقدم.
كل الأنواع تحمل حقل **Department** (قطاع الخدمة، يربط مع Settings→Departments).

## 11.3 Certificates
شهادات هدايا: Amount / For services / For cash value and services، مع أرقام تسلسلية وباركود دفعي (طباعة جماعية).

## 11.4 SMS notification / Personal SMS / E-mail notification
إرسال جماعي وفردي — يعتمد على تفعيل مزوّد SMS/Email من Settings.

## 11.5 Promotions
عروض بـ4 آليات حساب (% Discount / Fixed amount / تركيب الاثنين / Fixed sale price) + **قسم Trigger** (محرك قواعد شرطية، نفس مفهوم "Automatic assignment category clients").

## 11.6 Client acquisition sources
إدارة كاملة (Add/Edit/Delete) لقائمة مصادر معرفة الزبون بالصالون.

---

# 12. موديول Salary

**الوظيفة:** التنفيذ الفعلي (Execution/Ledger) لنتائج Payment Plans — مختلف عن Payment Plans (محرك الحساب).

- **الجدول الرئيسي**: تجميع بالـRole، بـ5 أعمدة محاسبية (Balance at start/Paid in previous/Charge/Paid in current/Balance at closing) — منطق Accrual كامل.
- **Operations history**: سجل Charge/Paid لكل عملية، بعمود Client يربط الراتب بمبيعات فعلية.
- **Salary payments**: تنفيذ الدفع الفعلي (From: Cash drawer، Import from Excel).
- **Distributions**: **مختلف عن Salary payments** — توزيع أرباح للـOwner تحديدًا (مفهوم محاسبي منفصل عن الراتب).
- **Award / Fine / Taxes**: الثلاثة يفتحون **نفس نافذة "Awards and fines"** بالضبط (Name+Amount) — Entity واحدة معاد استخدامها بعلامات مختلفة.
- **"Recalculate salary using current rates"**: إعادة حساب بأثر رجعي (نمط متكرر بالنظام).

---

# 13. موديول Documents

**الوظيفة:** إدارة قوالب مستندات (Mail merge) وملفات عامة.
- **Templates** جاهزة: Template for clients / for employees / Visits by companies report template.
- **Mass document printing** و**Send mass documents by E-mail**.
- Drag & Drop مباشر مع Windows Explorer — نفس آلية Files بملف الزبون.
- عمود **Modified by** يوفر Audit trail بمستوى المستخدم.

---

# 14. موديول Cash per day

**الوظيفة:** "القلب المحاسبي" — سجل الصندوق اليومي، مقابل Salary اللي هو سجل شهري/دوري.

- **ملخص يومي**: Beginning cash drawer + Gross income − Costs = Total → Deposited/Left for tomorrow.
- **8 عمليات رئيسية**:
  - Petty cash out (مصاريف تشغيلية غير مرتبطة برواتب أو موردين).
  - Employee cash drop.
  - Remove credit / Return to client.
  - **Add money** (dropdown: From owner / Return employee's debt / Other income) — يفسّر كيف تُسدَّد سلفات الموظفين.
  - Add to balance.
  - Transfer between accounts (Bank/Cash/Safe).
- **Billing costs**: نظام "Budget" فرعي كامل لإدارة فواتير الموردين الدورية (Add invoice for payment، Add payment، Companies-services، Costs catalog).

**خريطة الحسابات الثلاثية (Bank account / Cash drawer / Safe)** تُدار مركزيًا من Location settings→Accounts وتُستخدم بكل عملية مالية بالنظام.

---

# 15. موديول Reports

**الوظيفة:** طبقة تحليلية شاملة فوق كل البيانات (~90+ تقرير مصنّف بمجلدات: Cash Flow، Clients، Services، Products، Fixed assets، Groups، Cards/Certificates، Clients feedbacks، Salaries and bonuses، Calls، Companies، Client's balance).

**اكتشافات مهمة من الشجرة نفسها:**
- **Fixed assets**: مفهوم محاسبي جديد كليًا (أصول ثابتة/معدات).
- **Clients feedbacks**: نظام تقييم مستقل (يُغذّى من Dashboard→Services/Professionals rating وSettings→Request for review).
- **"My salary"**: تقرير Self-service — كل موظف يشوف راتبه هو بس.
- **Revenue by departments**: تحليل مالي حسب قطاع الخدمة، يربط مع Location area (م²).

---

# 16. موديول Settings — الغرفة المركزية للتحكم

## 16.1 Program settings (إعدادات على مستوى قاعدة البيانات كلها)
- **Name**: شعارات، هوية بصرية.
- **Currency**: عملة رئيسية + عملات إضافية متعددة.
- **Departments**: **الحل النهائي للغز** — قطاعات الخدمة (نفس Type of business من الـWizard)، تدار بشجرة هرمية.
- **Sending SMS / E-mail / Reports to E-mail**: طبقة تجريد (Gateway abstraction) لربط مزوّدين خارجيين حسب البلد (Twilio, Nexmo, SendGrid... + AIHelps Test SMS كمزوّد داخلي تجريبي).
- **Security**: Forbid screenshots.
- **Backup**: نسخ احتياطي مُدار بالكامل من AIHelps (مو Self-service).
- **Telephony**: تكامل PBX (Asterisk+MySQL / Binotel / Phonet) — يفعّل Caller ID بموديول Calls.
- **Clients**: 6 أنظمة رسائل تلقائية كاملة (Birthday greetings، Reminder of appointment، Request for review + Feedback notifications، Gift card expiration reminder، Reminder if client hasn't visited، **Campaign "Bring your friend"** — نظام إحالة مستقل بحساب بونص خاص).
- **Surveys**: بناء استبيانات ديناميكي (Multiple choice، Multi-select، فلترة بالجنس).
- **Sales**: إعدادات POS تشغيلية دقيقة (Backbar payment، Rounding، Accuracy of measurement units، Touch screen mode، Waiter workplace).
- **VAT**: ضريبة قابلة للتخصيص لكل عنصر أو Global list.
- **Planning**: مؤشرات KPI قابلة للتخصيص (تطابق بنود Cash Flow report).
- **Employee's bonuses**: تحديد **مين ياخد بونص الزيارة** (مسجّل الحجز أو مستلم الدفعة).
- **Employees sales**: تسعير خاص + قاعدة حساب الراتب لما الموظف يشتري لنفسه.
- **Discounts**: سقف خصم أقصى لكل فئة + Graduated commission discount عام (نمط احتياطي).
- **Cards**: قواعد عامة (Recalculate بأثر رجعي عند تغيير الإعدادات).
- **Display**: تفضيلات واجهة.
- **Tickets → Requisites**: تصميم الإيصال الكامل (شعار، حقول ظاهرة، Requisites قانونية منفصلة لكل نوع مبيع).
- **Tickets → Reminder**: تجميع كل تنبيهات النظام الداخلية بمكان واحد.

## 16.2 Location settings (إعدادات خاصة بكل فرع)
- **Information about location**: Demo version (Light/Standard/**Ultimate**)، Location code (يُستخدم كمعرّف رابط الحجز الأونلاين).
- **Theme color**: لون واجهة مستقل لكل فرع.
- **Work hours**: جدول الفرع (يمكن يختلف عن الجدول العام).
- **Accounts**: التأكيد النهائي لنظام Bank account/Cash drawer/Safe.
- **Zones and halls**: نظام غرف/قاعات — **بُعد ثالث للجدولة** غير الموظف والزبون، لمنع الحجز المزدوج بنفس المكان.
- **Location area**: مساحة الفرع بالمتر المربع، مقسّمة حسب Departments — لحساب مؤشر "الإيراد لكل م²".
- **Salary (مستوى الفرع)**: Daily/Monthly pay rules، Penalty for being late، **Replace professional fine**.

## 16.3 Optional equipment (أجهزة محلية على الكمبيوتر)
Receipt printer، **Fiscal registrar** (طابعة ضريبية قانونية، محصورة بدول Germany/Kazakhstan/Kyrgyzstan/Slovakia/Ukraine — أقوى دليل جغرافي على أصل الشركة)، POS-terminal، Barcode reader (مع Format Cards متقدم)، **Fingerprints' reader** (ZKTeco — يفعّل Check-in log الفعلي)، Labels printer، Printer for clients' cards، Scales (AXIS)، **Tanning bed** (Lamp life tracking + Cooling time)، **Epilation** (Laser type, Diameter, Power).

## 16.4 Additional modules (ميزات اختيارية Add-on)
- **Follow up visits**: دورية متابعة مخصصة لكل خدمة/زبون + تقرير + تذكيرات.
- **Additional sales**: توصيات Upsell/Cross-sell موجّهة، مرتبطة بـPurchase requests عند نفاد المخزون.

## 16.5 Online booking module settings
موقع/Widget حجز عام كامل موجّه للزبائن:
- **Appearance**: ألوان، شعار، لغة (مستقلة عن لغة الواجهة الداخلية).
- **Process bookings**: قواعد الحجز (تأكيد الإداري، إلغاء 48 ساعة مسبقًا، منع فئات معينة من الحجز، **Enable auto mode** لتقليل فجوات الجدول).
- **Services / Professionals**: تحكم دقيق بأي خدمة/موظف يظهر أونلاين.
- **Post online**: ربط بفيسبوك/إنستقرام + **كود Embed حقيقي** (JavaScript widget) لأي موقع خارجي + Google Analytics tracking.

---

# 17. موديول Dashboard

**الوظيفة:** طبقة تجميعية بصرية فوق كل الموديولات — كل بطاقة (Accounts, Profit and loss, Scheduled visits, Booking history, Online booking, Products, Clients, Client retention) هي اختصار لتقرير موجود أصلًا بـReports، مع فلتر فترة مستقل وزر "View detailed report" للتعمق.
**Services rating / Professionals rating**: نظام تصنيف تلقائي مبني على بيانات مبيعات وتقييمات حقيقية (يحتاج بيانات كافية ليعمل).

---

# 18. الخلاصة المعمارية الشاملة

## الأنماط المتكررة (Reusable Design Patterns) عبر النظام:
1. **Graduated commission** — يظهر بـPayment Plans، Accumulative card، وSettings كإعداد عام.
2. **Awards/Fines/Taxes** — نفس الـDialog بالضبط بثلاث تسميات مختلفة.
3. **Folder tree + item list** — نمط موحّد لكل الكتالوجات (Services, Cards, Certificates, Documents, Promotions).
4. **Drag & Drop مع Windows Explorer** — نفس الآلية بملف الزبون وبموديول Documents.
5. **Recalculate بأثر رجعي** — يظهر بـSalary وCards، بتحذير صريح قبل التنفيذ.
6. **رسائل تلقائية بنفس البنية** — Toggle + توقيت + محرر نص + Placeholders قابلة للسحب + معاينة SMS حية، مكرر 6+ مرات بـSettings→Clients.

## خريطة تدفق الأموال الكاملة:
كل عملية مالية بالنظام (بيع، راتب، مصروف، تحويل) تمر حتمًا عبر واحد من ثلاث حسابات (**Bank account / Cash drawer / Safe**)، وتنعكس تلقائيًا بموديول **Cash per day** يوميًا، وتتجمّع بموديول **Reports→Cash Flow** دوريًا، وتُلخَّص بصريًا بـ**Dashboard**.

## خريطة الأدوار الوظيفية (Roles) الكاملة:
- **Professional**: منفّذ الخدمة الفعلي (له راتب من Payment Plans).
- **Administrator**: يبيع/يستقبل الدفعة (له بونص "For administrator").
- **Manager**: مسؤول متابعة الزبون طويل المدى (يُدار من موديول Calls، له بونص "To manager").
- **Service manager**: مسؤول عن خدمة معينة (بونص "To Service manager").
- **Owner**: صاحب الحساب (له Distributions منفصلة عن Salary).

هاد التوثيق يغطي عمليًا كل موديول رئيسي وفرعي بالنظام تم تحليله من لقطات الشاشة المرفوعة عبر المحادثة كاملة.
-e 

---

<div style="page-break-after: always;"></div>

# ═══════════════════════════════════════════
# القسم 2: خريطة الترابط وتدفق البيانات
# ═══════════════════════════════════════════

# خريطة الترابط الكامل وتدفق البيانات — نظام Beauty Pro
## كيف تنتقل البيانات بين الموديولات، وما هي العلاقات الحقيقية بين الوحدات

> هاد الملف مكمّل لملف "التحليل الشامل"، بس بزاوية مختلفة تمامًا: مش "شو وظيفة كل شاشة"، إنما **"كيف تتحرك البيانات فعليًا من موديول لموديول"**. الهدف: فهم النظام كـ**Data Flow Graph** واحد متكامل، مو كمجموعة شاشات منفصلة.

---

# 1. الكيانات الجذرية (Root Entities) التي يدور حولها كل شي

قبل الحديث عن التدفق، لازم نحدد **الكيانات الأساسية (Core Entities)** التي تتقاطع عندها كل الموديولات:

| الكيان | أين يُنشأ | من يستهلكه |
|---|---|---|
| **Client** | موديول Clients | Appointment book, Ticket, Calls, Marketing, Cash per day, Reports, Online booking |
| **Employee** | موديول Employees | Salary, Appointment book, Cash per day, Access Rights, Reports |
| **Service / Product / Group** | Services / Products / Groups | Ticket, Payment Plans, Appointment book, Marketing (Cards/Certificates), Reports |
| **Location** | Setup Wizard / Location settings | كل موديول تقريبًا (كل بيانات مرتبطة بفرع محدد) |
| **Account (Bank/Cash/Safe)** | Location settings → Accounts | Cash per day, Salary, Clients (Balance), كل عملية مالية |
| **Ticket (عملية بيع)** | شاشة Quick Sale | Salary, Cash per day, Reports, Client History |
| **Department** | Program settings → Departments | Marketing (Cards/Certificates)، Location area، Reports (Revenue by departments) |

**كل الموديولات الأخرى فعليًا هي "Views" أو "Operations" تُنشئ أو تستهلك هاي الكيانات السبعة.**

---

# 2. رحلة البيانات الكاملة: من الحجز حتى التقرير النهائي

هاي أهم رحلة بالنظام كامل — تتبّعها يوضح كيف يترابط كل شي:

```
1) Appointment book (حجز موعد)
        ↓ يسحب بيانات: Client + Professional + Service + Zone/Room
        ↓
2) Quick Sale / Ticket (تنفيذ البيع)
        ↓ يسحب: أسعار من Services/Products، خصومات من Client's Card/Category،
        ↓         Payment Plan المطبّق على (Professional × Service)
        ↓ يُنشئ: سجل بيع واحد يحمل Professional + Administrator + Client
        ↓
3) ينقسم التدفق لثلاثة اتجاهات متوازية فورًا:
        │
        ├──→ (أ) Cash per day
        │        يُسجَّل كـ"Gross income" باليوم، يؤثر على Total/Deposited/Left for tomorrow
        │        يُحدَّد أي حساب استُخدم (Cash drawer/Bank/Safe)
        │
        ├──→ (ب) Salary (لكل موظف متورط بالعملية)
        │        Payment Plan يُطبَّق تلقائيًا → عمود "Charge" بجدول الراتب
        │        Sale bonuses تُحتسب لـ4 أدوار: Professional/Administrator/Manager/Service manager
        │        (القاعدة: مين ياخد بونص الزيارة تحددها Settings→Employee's bonuses)
        │
        └──→ (ج) Client History (تبويب History بملف الزبون)
                 يُسجَّل: Date, Amount, Payment method, Bonus, Card, Products
                 يُحدَّث: Client's balance (لو استُخدم Balance بالدفع)
                 يُحدَّث: رصيد أي Card/Certificate استُخدم

4) من نقطتي (أ) و(ب) و(ج) مجتمعين:
        ↓
5) Reports (كل شي يتجمّع هون: Cash Flow, Profit and loss, Salaries and bonuses,
   Client's visits, Profitability of services...)
        ↓
6) Dashboard (اختصار بصري لأهم أرقام Reports، بفلترة فترة سريعة)
```

**الخلاصة:** عملية بيع واحدة (Ticket) هي **نقطة الانطلاق الحقيقية** لثلث بيانات النظام تقريبًا — كل موديول مالي أو تحليلي بالنهاية يقرأ من نفس الـTicket بزوايا مختلفة.

---

# 3. تدفق بيانات الزبون عبر النظام

```
Marketing → Client acquisition sources  ─┐
Settings → Surveys                        ├──→ (تُغذّي) حقل "Client acquisition source"
Online/Facebook/Instagram booking widget ─┘         بنموذج Add client

Add client (Clients module)
    ├─→ Category (Black list/VIP/Family) ──→ تُستخدم بـ:
    │        • Marketing: فلترة Bulk SMS
    │        • Online booking settings: منع فئة معينة من الحجز الذاتي
    │        • Reports: Grouping clients by rank
    │
    ├─→ Client acquisition source ──→ Reports: "Client acquisition sources" cost tracking
    │
    ├─→ Manager / Service manager / Professional (حقول علاقة) ──→ 
    │        • موديول Calls: يدير حقل Manager تحديدًا
    │        • Payment Plans→Sale bonuses: يحدد توزيع البونص عند كل عملية بيع
    │
    └─→ Maximum debt total ──→ يُقيَّد بواسطة Settings→Discounts→Maximum discount
                                 ويُستهلك عبر Cash per day→Remove credit

Client's Balance (رقم واحد Ledger)
    ├─ Add to balance ──→ يُسجَّل بـ Cash per day كـ"Other income" مرتبط بحساب
    ├─ Remove credit  ──→ نفس الـDialog بالضبط، يظهر بموديولين (Clients + Cash per day)
    └─ استخدام الرصيد بالـTicket ──→ يظهر بعمود "Amount paid with balance"
                                       بـPayment Plans (خصم من إجمالي حساب الراتب)
```

---

# 4. تدفق بيانات الموظف عبر النظام

```
Employees (إنشاء الموظف)
    ├─→ Role (Folder + Additionally = Multi-role) ──→ يحدد:
    │        • أي شجرة Access Rights تُطبّق عليه
    │        • تجميعه بجداول Salary وSchedule for month
    │        • ظهوره كـ"عمود" بـAppointment book
    │        • أهليته للظهور بـOnline booking→Professionals (حسب Category)
    │
    ├─→ Work schedule (عام + لكل Location) ──→ يُستهلك بـ:
    │        • Appointment book (تحديد الأوقات المتاحة)
    │        • Schedule for month (المقارنة مع "Fact" الفعلي)
    │        • Online booking→Process bookings (منع حجز خارج الدوام)
    │
    ├─→ Payment Plan (Percent/Graduated) المطبّق من مصفوفة "Payment" ──→
    │        يُفعَّل تلقائيًا بكل Ticket يشارك فيه هاد الموظف
    │        → يتحول لعمود "Charge" بموديول Salary
    │
    └─→ Access Rights ──→ تتحكم حرفيًا بكل زر/حقل يشوفه هاد الموظف
             بكل الموديولات (Clients, Products, Marketing, Employees, Salary,
             Cash per day, Reports, Settings, Mobile app)

Check-in (بصمة/بطاقة عبر Optional equipment→Fingerprints' reader)
    ↓
Clients module → Check-in log (سجل حضور خام)
    ↓
Employees → Schedule for month → عمود "Fact" (مطابقة الحضور الفعلي بالمخطط)
```

---

# 5. تدفق البيانات المالية (أهم تدفق بالنظام)

```
مصدر أي حركة مالية
    │
    ├─ بيع (Ticket)
    ├─ Salary payments / Distributions / Award / Fine / Taxes
    ├─ Petty cash out / Add money / Add to balance / Remove credit
    ├─ Return to client / Employee cash drop
    ├─ Billing costs → Add payment (لموردين)
    └─ Transfer between accounts
            │
            ▼
    كل حركة تُحدَّد لها حساب واحد من:
    [ Cash drawer | Bank account | Safe ]  ← مُدارة من Location settings→Accounts
            │
            ▼
    Cash per day (السجل اليومي)
    Beginning cash drawer + Gross income − Costs = Total
            │
            ▼
    Reports → Cash Flow
    Gross income (Services+Sold products) مقابل Costs (Salary+Payments to suppliers)
    = Net income
            │
            ▼
    Dashboard → Accounts / Profit and loss (اختصار بصري + Profit Margin %)
            │
            ▼
    Settings → Planning (نفس بنود Cash Flow، تُستخدم كأهداف/KPI للمقارنة)
```

**ملاحظة معمارية مهمة:** *نفس الـDialogs* (Remove credit، Add to balance، Salary payments) تظهر بأكثر من موديول (Clients، Salary، Cash per day) — دليل إنها **Entity واحدة بالـBackend وليست نُسخ منفصلة**، وأي تعديل من أي نقطة دخول ينعكس فورًا بكل الأماكن التانية.

---

# 6. تدفق بيانات التسويق (Marketing → Sales → Reports)

```
Marketing → Cards/Certificates/Promotions (تعريف القوالب)
    ↓
Client's Cards tab (بيع الكارت للزبون الفعلي)
    ↓
Ticket (استخدام الكارت وقت الشراء: خصم/بونص/استهلاك اشتراك)
    ↓
    ├─→ Client History → عمود "Bonus, Bonuses used, Gift certificate"
    ├─→ Payment Plans → إذا الكارت فيه "Professional's bonus" يُضاف لراتب موظف محدد
    └─→ Reports → Sale of cards, Use of gift certificates, Sales with bonuses

Settings → Campaign "Bring your friend" (نظام إحالة مستقل)
    ↓ يعمل بالتوازي مع نظام Bonus card، بس بمنطق مختلف:
    Client A بونص = % من مشتريات Client B (وليس % من مشترياته هو)
    ↓
    Client's Balance (البونص يُضاف كرصيد قابل للاستخدام)

Settings → Surveys / Client acquisition sources
    ↓ تُغذّي حقل "Client acquisition source" بنموذج Add client
    ↓
Reports → Client acquisition sources cost tracking (تحت Costs بـPlanning)
```

---

# 7. تدفق بيانات الجدولة والموارد (Scheduling)

```
Location settings → Work hours (ساعات عمل الفرع العامة)
    +
Employees → Work schedule (لكل موظف، لكل Location)
    +
Location settings → Zones and halls (الغرف/القاعات المتاحة)
    ↓ الثلاثة يتقاطعون معًا بـ:
Appointment book
    ↓ عند إنشاء موعد، النظام يتحقق من توفر:
    1. الموظف (Work schedule)
    2. الغرفة (Zone/Hall — "Prohibit simultaneous booking")
    3. حالة الزبون (مو من فئة محظورة بـOnline booking إذا الحجز أونلاين)
    ↓
Online booking module (الواجهة العامة للزبون)
    ↓ يستهلك نفس بيانات Services/Professionals/Departments
    ↓ لكن بفلترة إضافية: أي خدمة/موظف "متاح للحجز الأونلاين" تحديدًا
    ↓ خوارزمية "Enable auto mode" تحاول تسد فجوات الجدول تلقائيًا
    ↓
Calls module → Show all upcoming calls and visits (يعرض نفس المواعيد كتذكير للمتابعة)
```

---

# 8. تدفق بيانات الإعدادات (Settings) كـ"مصدر حقيقة" لباقي النظام

Settings مش موديول تشغيلي، هو **مصدر القيم الافتراضية والقواعد** التي تُستهلك بكل مكان:

```
Program settings → Departments
    ↓ يُستهلك بـ: Marketing (Cards/Certificates)، Location area، Reports،
                    Online booking→Services categories

Program settings → Sending SMS/Email
    ↓ يُستهلك بـ: Marketing (SMS/Email notification)، Settings→Clients (كل الرسائل التلقائية)،
                    Documents (Send mass documents by E-mail)

Program settings → Employee's bonuses (قاعدة "مين ياخد بونص الزيارة")
    ↓ تُطبَّق تلقائيًا بكل Ticket → تحدد عمود "For administrator" بـSale bonuses

Program settings → Discounts → Maximum discount
    ↓ يُقيّد كل خصم يُعطى بـTicket من قبل أي Administrator

Location settings → Accounts
    ↓ يُغذّي كل dropdown "From/To" بكل موديول مالي (Cash per day, Salary, Clients)

Optional equipment → Fiscal registrar / Fingerprints' reader / Telephony
    ↓ تفعّل ميزات حقيقية بموديولات أخرى (الإيصال القانوني، Check-in log، Caller ID)
```

---

# 9. خريطة الترابط الشاملة (Module Dependency Map)

```
                              ┌─────────────┐
                              │  Settings   │  ← مصدر القواعد لكل شي
                              │ (كل التبويبات) │
                              └──────┬──────┘
                                     │ يغذّي قيم افتراضية وقواعد
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
              ┌──────────┐    ┌──────────┐    ┌──────────────┐
              │ Employees│    │ Clients  │    │Services/Products│
              └────┬─────┘    └────┬─────┘    └───────┬──────┘
                    │               │                  │
                    └───────┬───────┴──────────┬───────┘
                             ▼                  ▼
                     ┌───────────────┐   ┌─────────────┐
                     │Appointment book│──▶│  Marketing  │
                     └───────┬────────┘   └──────┬──────┘
                              ▼                    │
                     ┌────────────────┐            │
                     │  Ticket (Sale) │◀───────────┘
                     └───────┬────────┘
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
              ┌─────────┐┌─────────┐┌──────────┐
              │  Salary ││Cash per ││ Client   │
              │         ││   day   ││ History  │
              └────┬────┘└────┬────┘└────┬─────┘
                    └──────────┼──────────┘
                                ▼
                        ┌───────────────┐
                        │    Reports    │
                        └───────┬───────┘
                                ▼
                        ┌───────────────┐
                        │   Dashboard   │
                        └───────────────┘

     [ Calls ]───────يدير Manager الخاص بـ Clients
     [ Documents ]────يسحب بيانات Clients/Employees للـ Templates
     [ Online booking ]───واجهة بديلة لـ Appointment book، تتقاطع مع Clients/Services/Employees
```

---

# 10. أمثلة سيناريوهات كاملة (End-to-End)

## سيناريو 1: زبونة جديدة تحجز موعد قص شعر أونلاين
```
Online booking widget (بالموقع الخارجي)
  → تختار Service (من قائمة Settings→Online booking→Services المسموحة)
  → تختار Professional (من قائمة Settings→Online booking→Professionals المسموحة)
  → النظام يتحقق من Work schedule للموظف + توفر Zone (إذا محددة)
  → يُنشأ حجز بـAppointment book تلقائيًا
  → إذا "Book client only after administrator's confirmation" مفعّلة → الحجز بحالة انتظار
  → عند الوصول: Quick Sale → Ticket
  → الزبونة الجديدة تُنشأ تلقائيًا بـClients (لو ما كانت موجودة) بحالة "potential" → "active" بعد أول زيارة
  → Client acquisition source تُسجَّل تلقائيًا كـ"online booking module"
```

## سيناريو 2: بيع خدمة بونص متعدد الأدوار
```
Ticket: خدمة "صبغة شعر" ← منفّذها Professional (X) ← باعها Administrator (Y)
Client عندها Manager = (Z) مسجّل من موديول Calls
Service عندها Service manager = (W) محدد بـEmployees
    ↓
Payment Plans → Sale bonuses يُفعّل تلقائيًا:
  Professional (X) ← راتب "Salary for work" من Percent Plan
  Administrator (Y) ← "For administrator" bonus (لو مفعّلة بـSettings)
  Manager (Z) ← "To manager" bonus
  Service manager (W) ← "To Service manager" bonus
    ↓
كل الأربعة يظهرون كسطور منفصلة بجدول Salary تحت Role كل واحد فيهم
    ↓
Cash per day يسجّل قيمة البيع الإجمالية كـGross income مرة واحدة فقط
```

## سيناريو 3: موظف ياخد سلفة ويرجّعها
```
Cash per day → Add money → لا (هون مش السلفة، هاي للدخل)
الموظف ياخد سلفة عبر: Salary → "Balance at the start date" يصير سالب
    (دَين الموظف للشركة)
    ↓
لاحقًا: Cash per day → Add money → "Return employee's debt"
    ↓
Salary → عمود "Paid in previous period" يُحدَّث
    ↓
Balance at closing date يرجع يتوازن
```

---

# 11. الخلاصة: النظام كـ"دورة واحدة مغلقة"

كل موديول بالنظام هو **إما مصدر بيانات (Source)، أو معالج (Processor)، أو مستهلك/عارض (Sink)**:

- **مصادر (Sources)**: Clients, Employees, Services/Products, Settings (القواعد).
- **معالجات (Processors)**: Appointment book (يجدول)، Ticket/Quick Sale (يبيع وينفّذ الحساب)، Payment Plans (يحسب الراتب)، Marketing (يحسب الخصومات/البونص).
- **مستهلكات/عارضات (Sinks)**: Salary, Cash per day, Client History (تسجيل)، Reports (تحليل)، Dashboard (عرض).

**الترابط الأعمق:** أي تغيير بـ**Settings** (قاعدة عامة) أو بـ**Employees→Payment Plans** (قاعدة خاصة بموظف) لا ينعكس تلقائيًا على المبيعات القديمة — لهيك النظام بنى آلية **"Recalculate"** صريحة (بتحذير) بأكثر من مكان (Salary، Cards) لإعادة حساب البيانات التاريخية عمدًا عند الحاجة، بدل التحديث التلقائي الصامت الذي قد يُفسد سجلات محاسبية مقفلة.
-e 

---

<div style="page-break-after: always;"></div>

# ═══════════════════════════════════════════
# القسم 3: قواعد العمل الكاملة
# ═══════════════════════════════════════════

# قواعد العمل الكاملة (Business Rules) في نظام Beauty Pro
## استنتاج شامل — الصريح منها والضمني — مع تبرير كل قاعدة

> هاد الملف يفترض دور "محلل أعمال يعكس هندسة النظام" (Reverse Business Analysis). كل قاعدة هون إما **مذكورة صراحة** بالواجهة، أو **مُستنتجة منطقيًا** من تصميم الحقول/الأزرار/التسلسلات اللي شفناها. كل قاعدة مرفقة بـ"سبب الاستنتاج" — أي دليل UI أو منطقي أدّى لاستخراجها.

---

# 1. قواعد النطاق والفصل التنظيمي (Scope & Isolation)

### 1.1 كل بيانات النظام مرتبطة إجباريًا بفرع (Location) واحد على الأقل
**الدليل:** كل موديول مالي وتشغيلي (Work hours, Accounts, Zones, Salary rules, Theme color) له نسخة منفصلة بـ"Location settings"، بينما القواعد العامة بـ"Program settings".
**الاستنتاج:** لا يمكن وجود سجل بيع أو حركة مالية "معلّقة" بدون فرع مالك — كل Ticket لازم يُنسب لفرع محدد ليُحسب ضمن Cash per day وSalary الخاصين فيه.

### 1.2 الدولة (Country) تُقفل عند إنشاء قاعدة البيانات ولا تتغيّر لاحقًا
**الدليل:** نص صريح "Country is set on database creation and can't be changed".
**الاستنتاج:** كل الإعدادات الضريبية/القانونية (VAT rules، Fiscal registrar، Requisites) مبنية على افتراض أن الدولة ثابتة طول عمر الحساب — قاعدة عمل صارمة تمنع "تصدير" حساب لدولة أخرى بدون قاعدة بيانات جديدة كليًا.

### 1.3 "Common department" هو نطاق افتراضي شامل، لا قسم فعلي
**الدليل:** كل نموذج (Card, Certificate, Promotion) يفتح افتراضيًا على "Common department" رغم وجود أقسام فعلية مسمّاة (Barbershop, Massage...).
**الاستنتاج (ضمنية):** أي عنصر تسويقي بلا قسم محدد ينطبق على **كل** الأقسام تلقائيًا — قاعدة "Default = Universal" لا "Default = Undefined".

---

# 2. القواعد المالية والمحاسبية

### 2.1 كل حركة مالية يجب أن تُنسب لحساب واحد من ثلاثة (Bank/Cash/Safe)
**الدليل:** كل Dialog مالي بلا استثناء (Add money, Remove credit, Salary payments, Petty cash out...) يحتوي حقل From/To إجباري بنفس القائمة الثلاثية.
**الاستنتاج:** لا يمكن تسجيل أي حركة "بدون مصدر/وجهة" — قاعدة صارمة لمنع "الأموال المجهولة" (Untraceable cash) وضمان تطابق التقارير المالية.

### 2.2 الرصيد يُحتسب دائمًا بمنطق Accrual لا Cash-basis
**الدليل:** أعمدة "Balance at start / Charge / Paid / Balance at closing" مكرّرة بـSalary وCash per day، ومنفصلة عن "Paid" الفعلي.
**الاستنتاج:** المبلغ "المُستحق" (Charge) يُسجَّل فور تنفيذ الخدمة حتى لو لم يُدفع فعليًا — وهذا يعني النظام يفترض إمكانية وجود **دَين مزدوج الاتجاه**: الزبون قد يكون مديونًا للصالون (Client debt)، والصالون قد يكون مديونًا للموظف (Salary balance).

### 2.3 لا يمكن لأي إداري منح خصم يتجاوز السقف العام
**الدليل:** نص صريح "administrator can't give discount greater than specified for client" + حقل "Maximum discount" منفصل لكل فئة (Services/Products/Groups/Cards/Certificates).
**الاستنتاج:** الخصم له **سقفان متداخلان**: سقف عام على مستوى النظام (Settings→Discounts)، وسقف فردي محتمل لكل زبون ("for individual clients you can set a different value" مذكورة بنص Maximum debt) — القاعدة الفعلية: **السقف الأضيق هو الذي يُطبَّق دائمًا**.

### 2.4 إيراد بطاقة الاشتراك يُوزَّع محاسبيًا على مدار صلاحيتها، لا دفعة واحدة
**الدليل:** خيار "Distribute profit from membership card sales over the whole membership validity period in earnings report".
**الاستنتاج:** قاعدة Revenue Recognition — بيع بطاقة اشتراك 12 شهر بـ1200₪ لا يُسجَّل كـ1200₪ ربح باليوم الأول، بل 100₪/شهر — وهذا يعني تقرير "Profit and loss" الشهري لأي شهر **لا يعكس فعليًا كل النقد الداخل ذاك الشهر**، بل النقد + الأرباح المُستحقة من بطاقات سابقة.

### 2.5 "Distributions" (أرباح المالك) منفصلة قواعديًا عن "Salary" مهما كان دور الشخص
**الدليل:** نافذة Distributions تعرض فقط أشخاص بدور "Owner"، ببنية Dialog مطابقة تمامًا لـSalary payments لكن معزولة عنها.
**الاستنتاج:** حتى لو كان المالك يعمل فعليًا كـProfessional وله راتب من Payment Plans، فإن أي "توزيع أرباح" له يُسجَّل بمسار محاسبي منفصل تمامًا عن راتبه التشغيلي — فصل بين "أجر العمل" و"عائد الملكية"، وهو مبدأ محاسبي سليم.

### 2.6 عمولة بيع البطاقة تُحسب إما من قيمة البيع أو من السعر الأصلي، وهذا خيار عام واحد فقط
**الدليل:** "Payment upon the sale of the card: Calculated from the sales value of the card / Calculated from the price with a card" — راديو واحد بمستوى Location.
**الاستنتاج:** لا يمكن لموظف معين أن يُحسَب له بقاعدة مختلفة عن زميله لهذه النقطة تحديدًا — قاعدة موحّدة على مستوى الفرع كله، بعكس Payment Plans الفردية.

---

# 3. قواعد الجدولة والموارد

### 3.1 التحقق من التوفر يشمل 3 أبعاد وليس بُعدًا واحدًا
**الدليل:** Work schedule (الموظف) + Zones and halls مع "Prohibit simultaneous booking" (المكان) + Category الزبون (المحظورين من الحجز الأونلاين).
**الاستنتاج (ضمنية):** حجز موعد ناجح يتطلب توفر **الموظف والمكان والزبون معًا** في آن واحد — وليس فقط تفريغ خانة بالكاليندر. هذا يفسّر لماذا خدمة المساج تحتاج تكرار ظهورها بجدولين (جدول الموظف وجدول الغرفة) — القاعدة: **كل مورد محدود له جدول توفر مستقل يُحقَّق بالتوازي**.

### 3.2 يوجد وقت "تبريد" إجباري بين استخدامين متتاليين لبعض المعدات
**الدليل:** "Tanning bed cooling time: 3 minutes" كإعداد صريح.
**الاستنتاج:** النظام يفترض أن بعض الموارد الفيزيائية (غير الموظف) لها **قيود تشغيلية فيزيائية** (حرارة الجهاز، تعقيم) تفرض فجوة زمنية إجبارية بين حجزين — قاعدة تُطبَّق تلقائيًا بالجدولة بغض النظر عن رغبة الزبون بالوقت.

### 3.3 الحجز الأونلاين له قواعد أضيق من الحجز اليدوي دائمًا
**الدليل:** خيارات "Book client only after administrator's confirmation"، "Categories of clients who are prohibited from online booking"، "The client can cancel 48 hours in advance"، حد أدنى للحجز المسبق (5 دقائق).
**الاستنتاج:** القاعدة الضمنية: **الحجز اليدوي (من الإداري) مُعفى تلقائيًا من كل قيود الحجز الأونلاين** — لأن هذه القيود مذكورة حصرًا بتبويب Online booking module settings، لا بـAppointment book العام. أي أن الإداري يقدر يحجز لزبون من "Black list" يدويًا، لكن ذاك الزبون لا يقدر يحجز لنفسه أونلاين.

### 3.4 يمكن استبدال الأخصائي المسؤول عن مجموعة (Group) دون إلغاء الحجوزات
**الدليل:** تقرير/إجراء "Replace professional" مذكور بـGroups، وغرامة "Replace professional fine" بـSalary (Location level).
**الاستنتاج:** القاعدة: استبدال المدرّب بمنتصف دورة جماعية عملية **مدعومة رسميًا** بالنظام (وليست استثناءً يدويًا)، لكنها **قد تستوجب غرامة مالية** على الموظف الأصلي أو الفرع — يستنتج من وجود حقل "غرامة" مخصص لها تحديدًا، ما يعني الحدث متكرر بما يكفي ليستحق قاعدة مالية خاصة.

---

# 4. قواعد الموظفين والرواتب

### 4.1 راتب نصف يوم الدوام = نصف الراتب اليومي، فقط إذا فُعِّل صراحة
**الدليل:** خيار "Pay half of the salary for half of a working day" (Location→Salary)، معطّل افتراضيًا.
**الاستنتاج:** القاعدة الافتراضية (Off): **حضور جزئي = صفر أجر يومي** إلا لو صاحب الصالون فعّل التقسيم النسبي صراحة — يدل إنه النموذج الافتراضي يفترض "يوم كامل أو لا شيء" ما لم يُنص خلاف ذلك.

### 4.2 الغرامة على التأخير مبلغ ثابت لا نسبة
**الدليل:** "Penalty for being late: [مبلغ] ₪" — رقم مطلق وليس نسبة مئوية من الراتب.
**الاستنتاج (ضمنية):** الغرامة مصمّمة كرادع ثابت مستقل عن حجم راتب الموظف، بعكس آليات البونص اللي غالبًا نسبية — يوحي بفلسفة "الانضباط قاعدة موحّدة للجميع" بينما "التحفيز يتناسب مع الأداء الفردي".

### 4.3 بونص "زيارة الزبون" له مستفيد واحد فقط يُحدَّد بقاعدة عامة، لا حسب كل عملية
**الدليل:** dropdown واحد "the employee who made the entry / the employee who accepted the payment" + خيار "Bonus for the client visit is only for the administrator".
**الاستنتاج:** لا يمكن أن يقتسم موظفان (مسجّل الحجز ومستلم الدفعة) هذا البونص معًا — القاعدة حصرية (Either/Or) على مستوى النظام كله، لا قابلة للتخصيص لكل حالة على حدة.

### 4.4 مبيعات الموظف لنفسه تُحتسب بقاعدة راتب منفصلة عن مبيعاته العادية
**الدليل:** "Calculate salary for employees sales: from price for employees / from original price" — إعداد مستقل تمامًا عن Payment Plans العادية.
**الاستنتاج:** القاعدة تمنع "تحايل" الموظف على راتبه عبر شراء خدمة/منتج لنفسه بسعر مخفّض ثم احتساب عمولة كأنها بيع كامل السعر — بافتراض اختيار "from original price"، بينما "from price for employees" يمنحه مرونة أكبر إذا رغب صاحب الصالون.

### 4.5 تغيير قاعدة حساب بأثر رجعي يستوجب تأكيدًا صريحًا لأنه يعيد حساب بيانات تاريخية
**الدليل:** نافذة تحذير "Changing this setting will recalculate and change the attendance balances on all client cards (both active and long completed)... Continue?" + زر منفصل "Recalculate salary using current rates".
**الاستنتاج (قاعدة نظام عامة):** أي تعديل على **قاعدة حساب** (لا سجل فردي) يفرض على النظام مطالبة صريحة بالتأكيد قبل تطبيقه بأثر رجعي — قاعدة حماية بيانات مصمّمة عمدًا، لا سلوك افتراضي صامت.

### 4.6 الموظف الواحد قد يحمل أكثر من دور بنفس الوقت، وله سجل راتب موحّد يجمعها
**الدليل:** "Additionally" (Multi-role) بنموذج Employee، وجدول Salary مُجمَّع بالـRole لا بالموظف فقط.
**الاستنتاج:** القاعدة: راتب الموظف = مجموع كل مصادر الدخل من كل أدواره (Professional + Administrator مثلًا)، محسوبة بنفس الفترة المالية، لا حسابات منفصلة لكل دور.

---

# 5. قواعد إدارة الزبائن

### 5.1 الزبون يمر تلقائيًا بأربع حالات دورة حياة، دون تدخل يدوي مبدئيًا
**الدليل:** الحالات (potential/active/former/one-time) الظاهرة بفلاتر Birthday greetings وMarketing dropdown، وخيار "Mark clients as 'former' which was absent for more than [X] months [Y] days".
**الاستنتاج:** القاعدة: تحوّل الزبون من "active" إلى "former" **تلقائي بالكامل** بناءً على فترة غياب محددة، وليس قرارًا يدويًا من الإداري — والزبون الذي لم يزر أبدًا يبقى "potential" حتى إتمام أول عملية بيع تحوّله لـ"active" (أو "one-time" لو لم يعد بعدها).

### 5.2 التصنيف (Category) متعدد وليس حصريًا
**الدليل:** ظهور Multi-category ممكن (Black list + VIP بآن واحد محتمل من التصميم).
**الاستنتاج:** بعكس "الحالة" (State machine حصري)، فـ"الفئة" هي Tags متراكبة — قاعدة تسمح بمرونة تسويقية (زبون VIP وأيضًا "Family/friends" بنفس الوقت).

### 5.3 سقف الدين قابل للتخصيص فرديًا فوق السقف العام
**الدليل:** "This value is the default value for most clients, for individual clients you can set a different value".
**الاستنتاج:** القاعدة الهرمية: سقف الدين الافتراضي العام هو **Fallback**، ويمكن تجاوزه (رفعًا أو خفضًا) لزبون بعينه — القاعدة الفعلية المطبّقة عند البيع: **قيمة الزبون الفردية إن وُجدت، وإلا القيمة العامة**.

### 5.4 دمج زبونين مكررين عملية لا رجعة فيها تدمج التاريخ المالي أيضًا
**الدليل:** زر "Merge client" + تقرير "Duplicate clients" المخصص لاكتشافهم.
**الاستنتاج (ضمنية):** بما أن هناك تقريرًا مخصصًا لاكتشاف التكرار، فالنظام يفترض أن التكرار **مشكلة شائعة متوقعة** (زبون سجّل مرتين بأرقام هاتف مختلفة مثلًا)، وأن الدمج يجب أن يحافظ على تسلسل الرصيد/الكروت/التاريخ لا يفقد أيًا منها.

### 5.5 لا يمكن استخدام كارت خصم أو شهادة هدايا دون قراءتها فعليًا بالباركود، إذا فُعِّل الخيار
**الدليل:** "To use discount card it must be read using barcode reader first" و"To use gift certificate it must be read using barcode reader first" — كلاهما اختياري (checkbox).
**الاستنتاج:** قاعدة أمان ضد الاحتيال: تمنع إداريًا من "قول" إن الزبون معه كارت خصم دون تحقق فيزيائي فعلي عبر الباركود — تحويل الثقة من "تصريح شفهي" إلى "تحقق آلي".

---

# 6. قواعد التسويق والولاء

### 6.1 حساب البونص التراكمي يمنع "تضخم البونص" عبر خيار حسم البونص المستخدم مسبقًا
**الدليل:** "Calculate bonuses of the ticket total amount / Calculate bonuses of the ticket total amount minus used bonuses" — بـCampaign "Bring your friend".
**الاستنتاج:** لو زبون A دفع فاتورة 100₪ باستخدام 30₪ بونص سابق، القاعدة الافتراضية (الخيار الثاني، وهو المُفعَّل بالصورة) تحسب بونص الإحالة الجديد على أساس (100-30=70₪) فقط لا 100₪ كاملة — لمنع تراكم بونص "وهمي" على بونص سابق.

### 6.2 البونصات لها تاريخ صلاحية سنوي ثابت، لا فردي لكل عملية
**الدليل:** "Bonuses expire every year on these dates" — تواريخ ثابتة، لا "X يوم من تاريخ الاكتساب".
**الاستنتاج:** القاعدة: كل البونصات المكتسبة خلال السنة تنتهي بتاريخ موحّد واحد بغض النظر متى اكتُسبت (بعكس نموذج "كل بونص له صلاحية سنة من تاريخه") — أبسط بالحساب لكن قد يُجحف بزبون اكتسب بونص قبل يوم من انتهاء الصلاحية.

### 6.3 الشهادة قد تحمل قيمة بيع مختلفة عن قيمتها الفعلية عمدًا
**الدليل:** حقلا "Gift certificate for cash value" و"Price" منفصلان بنموذج Certificates.
**الاستنتاج:** القاعدة تسمح بعروض ترويجية (بيع شهادة بـ80₪ تحمل قيمة فعلية 100₪) — الفرق (20₪) هو خصم تسويقي مقصود يُدار من هذا الحقل تحديدًا لا من نظام الخصومات العام.

### 6.4 الرسالة المرسلة للزبون تختلف حسب كونها أول زيارة أو زيارة متكررة
**الدليل:** حقلا "Message after the first visit" و"Message after the following visits" منفصلان بـRequest for review.
**الاستنتاج:** قاعدة تسويقية ضمنية: النظام "يتذكر" ما إذا كانت هذه أول زيارة للزبون أم لا، ويُغيّر أسلوب الخطاب تلقائيًا (ترحيبي بالأولى، اعتيادي بالمتكررة) — دون تدخل يدوي من الإداري.

---

# 7. قواعد المخزون والمنتجات

### 7.1 لا يمكن بيع منتج غير متوفر بالمخزون، فقط إذا فُعِّل القيد صراحة
**الدليل:** "Sell only available products" — checkbox معطّل افتراضيًا بالبيانات المعروضة.
**الاستنتاج:** الوضع الافتراضي يسمح بالبيع بالسالب (Negative stock) — قاعدة تنظيمية مرنة تسمح بـ"بيع مسبق" لمنتج قيد الطلب، وتُفعَّل فقط لو صاحب الصالون أراد صرامة أكبر بإدارة المخزون.

### 7.2 سعر بيع المنتج يمكن اشتقاقه تلقائيًا من سعر الشراء الحالي، لا يُدخل يدويًا لكل تحديث
**الدليل:** "Automatically calculate the sale price of products from the current purchase price" + "Rounding up the selling price".
**الاستنتاج:** لو تغيّر سعر التوريد من المورد، سعر البيع للزبون **يتحدث تلقائيًا** حسب هامش ربح ثابت (مضمون بالخلفية) بدل أن يبقى السعر القديم ساري رغم تغيّر التكلفة — قاعدة حماية هامش الربح.

### 7.3 دقة الكسور العشرية تختلف حسب وحدة القياس، وتُطبَّق حتى على "قطعة" واحدة
**الدليل:** جدول "Accuracy of measurement units" (kg=3 خانات عشرية، pcs=0).
**الاستنتاج:** قاعدة تمنع بيع "0.5 قطعة" (لأن pcs محددة بصفر خانة عشرية) بينما تسمح ببيع "0.125 كغم" من مادة مستهلكة — تحقق تلقائي لمنطقية الكمية حسب طبيعة الوحدة.

---

# 8. قواعد الصلاحيات والأمان (RBAC)

### 8.1 الصلاحية على مستوى الحقل تسبق الصلاحية على مستوى الشاشة
**الدليل:** وجود صلاحية منفصلة "View and edit purchase prices" مستقلة عن الصلاحية العامة للوصول إلى Products.
**الاستنتاج:** القاعدة: موظف قد يملك صلاحية "الدخول لشاشة Products" لكن **دون رؤية سعر التكلفة تحديدًا** — تحقق أن النظام يقيّم كل حقل حساس على حدة، لا الشاشة ككتلة واحدة.

### 8.2 تعديل بيانات الأيام السابقة صلاحية منفصلة تمامًا عن الإدخال العادي
**الدليل:** صلاحية "Correction of data for past days" مذكورة ضمن Access Rights.
**الاستنتاج:** القاعدة الافتراضية الضمنية: **تعديل سجل بتاريخ ماضٍ محظور افتراضيًا** لأي موظف عادي (وإلا لما استوجب صلاحية مستقلة) — حماية من التلاعب بسجلات مقفلة محاسبيًا.

### 8.3 صلاحيات تطبيق الموبايل منفصلة تمامًا عن صلاحيات سطح المكتب
**الدليل:** قسم مستقل بشجرة Access Rights مخصص لتطبيق الموبايل، وحقل "Has access to the program from mobile application" منفصل بملف الموظف.
**الاستنتاج:** قاعدة: امتلاك حساب بالنظام لا يعني تلقائيًا امتلاك وصول موبايل — وحتى لو مُنح الوصول، الصلاحيات هناك **قد تكون أضيق** بشكل مستقل (يُستنتج من وجود شجرة منفصلة بالكامل، لا Checkbox واحد فقط "enable mobile").

### 8.4 منع لقطات الشاشة قابل للتفعيل كسياسة عامة، ما يوحي بحساسية بيانات مالية/شخصية
**الدليل:** "Forbid screenshots" بـSecurity settings.
**الاستنتاج (ضمنية):** وجود هذا الخيار تحديدًا (نادر بأنظمة ERP عادية) يوحي أن صاحب الصالون قد يُلزَم قانونيًا أو تعاقديًا (حماية بيانات الزبائن، أرقام بطاقات، رواتب الموظفين) بمنع تسريب الشاشة — قاعدة امتثال (Compliance) أكثر منها ميزة تقنية.

---

# 9. قواعد التكامل مع الأجهزة الخارجية

### 9.1 قارئ البصمة أوثق من البطاقة لتتبع الحضور، والنظام يقرّ بذلك صراحة
**الدليل:** "This is more reliable than monitoring with the help of plastic cards... because one cannot transfer or copy his fingerprints unlike the cards."
**الاستنتاج:** قاعدة عمل ضمنية: النظام **يفترض احتمال تلاعب** بالحضور عبر تمرير بطاقة زميل (Buddy punching) — ولذلك يقدّم البصمة كحل أوثق، ما يدل أن "الحضور المسجَّل بالبطاقة" ليس دليلًا قاطعًا بحد ذاته على حضور الشخص فعليًا.

### 9.2 لا يمكن إصدار فاتورة قانونية معتمدة إلا إذا كانت الدولة تدعم Fiscal registrar
**الدليل:** قائمة الدول المدعومة محصورة (Germany, Kazakhstan, Kyrgyzstan, Slovakia, Ukraine) بينما فلسطين (دولة الحساب بالـDemo) غائبة تمامًا.
**الاستنتاج:** القاعدة: الفواتير بالدول غير المدعومة تبقى "إيصالات داخلية" (Normal receipt) دون قيمة ضريبية رسمية معتمدة — وهذا يعني الامتثال الضريبي الكامل عبر النظام **مرتبط بجغرافيا الدولة لا بإرادة صاحب الصالون**.

---

# 10. القاعدة الجوهرية المُستخلصة من كل ما سبق

بجمع كل القواعد أعلاه، تظهر **فلسفة تصميم واحدة متكررة**: **"الافتراضي مرن ومسامح، والتشديد اختياري ومقصود"**.

كل قيد صارم بالنظام (سقف دين، منع بيع بدون مخزون، تأكيد قراءة الباركود، تصحيح بيانات الماضي) هو **معطّل افتراضيًا ويحتاج تفعيلًا صريحًا**، بينما كل ما يسهّل العمل اليومي (بيع بالسالب، تقريب الأسعار، حجز بلا تأكيد إداري) هو **الوضع الافتراضي**. هذه قاعدة عمل عليا (Meta-rule) تعكس فهمًا تجاريًا واضحًا: **صاحب الصالون الصغير يريد نظامًا لا يعرقله من اليوم الأول، ويستطيع تشديد الرقابة تدريجيًا فقط عندما يكبر فريقه ويحتاج ضبطًا أكبر**.
-e 

---

<div style="page-break-after: always;"></div>

# ═══════════════════════════════════════════
# القسم 4: السيناريوهات الاستثنائية
# ═══════════════════════════════════════════

# السيناريوهات الاستثنائية (Edge Cases) — نظام Beauty Pro
## الإلغاء، التعديل بعد الاعتماد، الحذف، التراجع، المرتجعات، الدفع/التسليم الجزئي، والأخطاء المحتملة

> هاد الملف يحلّل **الحالات الاستثنائية** — مو "المسار السعيد" (Happy path) يلي حللناه بالملفات السابقة. لكل سيناريو: **الدليل من الواجهة** (لو موجود)، **كيف يُرجَّح أن النظام يتعامل معه** بناءً على الأنماط المعمارية المكتشفة، و**الفجوات/المخاطر** حيث الدليل ناقص أو غير مؤكد.

---

# 1. الإلغاء (Cancellation)

## 1.1 إلغاء موعد (Appointment)
**الدليل المباشر:** عمود "Cancelled and no-show visits" بشجرة Reports، وحقل "Send a message, when appointment is canceled" بـSettings→Clients→Reminder of appointment، و"Appointment cancellation message" مع Placeholders مخصصة.
**كيف يُعالَج:** إلغاء الموعد **حدث مسجَّل له سجل مستقل** (مو مجرد حذف الصف من الكاليندر) — لأن فيه تقرير مخصص له، ورسالة SMS تلقائية تُرسل للزبون. الموعد المُلغى على الأغلب يبقى بقاعدة البيانات بحالة "Cancelled" (Soft state) لا يُحذف فعليًا، ليبقى قابلاً للإحصاء بتقرير "Cancelled and no-show visits" (يُفرَّق بين الاثنين: ملغى بإشعار مسبق مقابل عدم حضور بدون إشعار).
**الفجوة:** لم نشاهد نافذة "سبب الإلغاء" مباشرة، لكن Settings→Sales تحتوي زر **"Edit cancel reasons"** — يعني الإلغاء **يتطلب سببًا من قائمة مُدارة مسبقًا** (Reason code)، وليس إلغاءً حرًا بدون تبرير. هذا يفسّر لماذا موديول Reports فيه أيضًا "Cancelled sales" منفصل — الإلغاء له تصنيف/سبب قابل للتحليل لاحقًا.

## 1.2 إلغاء عملية بيع (Ticket/Receipt Cancellation)
**الدليل المباشر:** عمود **"Cancel"** ظاهر صراحة بجدول Cash per day (Time | **Cancel** | Type | Name | Client...)، وصلاحية RBAC منفصلة **"Cancel receipts"**، وتقرير **"Cancelled sales"** بشجرة Reports.
**كيف يُعالَج:** إلغاء فاتورة **ليس حذفًا**، هو **حالة (Flag) تُعلَّم بها الفاتورة** ضمن نفس الجدول اليومي (عمود مخصص لهذا الغرض بجانب كل صف). الفاتورة تبقى مرئية بالسجل، لكن مُستبعدة من "Gross income" الفعلي. هذا يحافظ على **تسلسل الأرقام (Numbering)** بالإيصالات — مهم جدًا بالدول التي تفرض ترقيمًا تسلسليًا إلزاميًا للإيصالات (نفس منطق Fiscal registrar وRequisites→Receipt numbering).
**قاعدة استنتاجية:** بما أن "Cancel receipts" صلاحية منفصلة بالـRBAC، فإن **الإلغاء محصور بموظفين محددين** (عادة Owner/Administrator بصلاحية عليا)، لمنع أي موظف من "إخفاء" بيع نفّذه عبر إلغائه لاحقًا للتلاعب براتبه أو بالصندوق.

## 1.3 إلغاء بونص/عرض ترويجي أثناء التطبيق
**الفجوة:** لم نشاهد سيناريو صريح لهذا، لكن استنادًا لبنية "Promotions→Trigger"، يُرجَّح أن أي عرض له شرط تفعيل (Trigger) يمكن أن **يتوقف تلقائيًا** إذا لم يعد الشرط متحققًا (مثال: عرض "خصم لأول 10 زبائن باليوم" يتوقف تلقائيًا عند وصول الزبون الحادي عشر) — لكن هذا استنتاج معماري، لا دليل مباشر مؤكد.

---

# 2. التعديل بعد الاعتماد (Post-Approval Modification)

## 2.1 تعديل بيانات بتاريخ سابق (Past Data Correction)
**الدليل المباشر:** صلاحية RBAC مخصصة **"Correction of data for past days"**.
**كيف يُعالَج:** وجود صلاحية منفصلة يعني أن **التعديل على سجل بتاريخ ماضٍ محظور افتراضيًا**، ولا يُفتح إلا لمن يملك هذه الصلاحية تحديدًا (على الأغلب Owner فقط). هذا يمنع موظفًا عاديًا من "تعديل" عملية بيع الأسبوع الماضي لتغيير راتبه بأثر رجعي.
**السيناريو الاستثنائي الأعمق:** ماذا لو عُدِّل سعر خدمة اليوم، وأراد الإداري تطبيق السعر الجديد على فاتورة الأمس؟ — هذا بالضبط ما تحله آلية **"Recalculate salary using current rates"** (Salary) و**"Recalculate... attendance balances on all client cards"** (Cards)، وكلاهما يطلبان **تأكيدًا صريحًا** لأن العملية "بأثر رجعي" وتُغيّر أرقامًا مقفلة سابقًا.

## 2.2 تعديل Payment Plan بعد أن راتب الموظف "اعتُمد" (Charge محسوب)
**الفجوة:** لا يوجد دليل مباشر لما يحصل بالضبط لو غُيِّرت خطة الراتب بعد أن جدول Salary أظهر "Charge" لعملية بيع سابقة.
**الاستنتاج المرجّح:** استنادًا لوجود "Recalculate using current rates" كزر منفصل ومقصود (لا تحديث تلقائي فوري)، فالنظام **لا يعيد حساب الرواتب تلقائيًا وصامتًا** عند تغيير الخطة — التغيير يُطبَّق فقط على المبيعات الجديدة، والرواتب القديمة تبقى محسوبة بالخطة القديمة **إلى أن يُطلَب Recalculate صراحة**. هذا يحمي الموظف من مفاجأة "تخفيض راتب بأثر رجعي" غير مقصودة، لكنه يعني أيضًا أن صاحب الصالون **يحتاج تذكّر تفعيل Recalculate يدويًا** إذا أراد فعلاً التحديث — نقطة ضعف تشغيلية محتملة (سهل النسيان).

## 2.3 تعديل موعد مؤكد (Appointment Rescheduling)
**الدليل المباشر:** رسالة تلقائية كاملة "Appointment time changing message" بمتغيرات **"Past date/Past time"** منفصلة عن "Date/Time" الجديدين.
**كيف يُعالَج:** تغيير موعد **يحافظ على القيمة القديمة والجديدة معًا** بنفس الحدث (لإرسال رسالة "تم نقل موعدك من X إلى Y")، وليس استبدالًا كاملاً يمحو القيمة السابقة — يستنتج من وجود Placeholders منفصلة لكل من التاريخ/الوقت "القديم" و"الجديد" بنفس القالب.

## 2.4 تعديل عملية بيع مُغلَقة ماليًا (مثال: تصحيح خصم بعد الدفع)
**الفجوة:** لا يوجد دليل مباشر لآلية "تعديل فاتورة مدفوعة"، لكن استنادًا للنمط العام (Cancel + إعادة بيع، بدل تعديل مباشر)، يُرجَّح أن المسار الفعلي هو: **إلغاء (Cancel) الفاتورة الأصلية → إصدار فاتورة جديدة صحيحة** — لا "تعديل حي" لبيانات فاتورة موجودة، وذلك حفاظًا على سلامة الترقيم التسلسلي (Receipt numbering) والتوافق مع Fiscal registrar بالدول التي تفرضه.

---

# 3. الحذف (Deletion)

## 3.1 حذف زبون
**الدليل المباشر:** لم نشاهد زر "Delete" مباشر بملف الزبون، بل زر **"To archive"** فقط.
**الاستنتاج:** النظام **لا يدعم حذفًا فعليًا (Hard delete) للزبون على الأرجح** — الأرشفة (Soft delete) هي المسار الوحيد، لأن حذف زبون فعليًا سيكسر كل الروابط التاريخية (History، Salary→Charge المرتبط بعمليات بيعه، Reports). الزبون المؤرشف يُستبعد من القوائم النشطة لكن يبقى قابلًا للاسترجاع.

## 3.2 حذف موظف
**الدليل المباشر:** نفس المنطق — وجود "Merge with employee" (دمج) يوحي بأن الحذف الفعلي غير مدعوم أو غير مرغوب به، لأن أي سجل راتب/مبيعات تاريخية مرتبط بذاك الموظف.
**السيناريو الاستثنائي:** موظف استقال ولديه "Balance" غير صفري بجدول Salary (دَين له أو عليه) — لا يمكن حذفه ببساطة، لأن هذا سيُفقد تتبع الدَين. الأرجح أن الحل هو **تعطيل الحساب (Deactivate)** لا حذفه، مع بقاء الرصيد قابلاً للتسوية لاحقًا عبر Cash per day→Add money→Return employee's debt.

## 3.3 حذف عنصر من كتالوج (خدمة/منتج) له تاريخ بيع سابق
**الفجوة:** لا دليل مباشر، لكن معماريًا (بناءً على نمط الشجرة الهرمية Folder+Item بكل الكتالوجات)، يُرجَّح وجود قيد ضمني: **لا يمكن حذف خدمة/منتج له عمليات بيع مرتبطة** (Referential integrity) — الخيار الآمن الوحيد هو "Write-off" (بالنسبة للمنتجات، موجودة صراحة بشجرة Reports→Products) أو التعطيل بدل الحذف الفعلي.

## 3.4 حذف حساب مالي (Bank/Cash/Safe) به رصيد
**الدليل المباشر:** زر **"To archive"** (وليس Delete) بشاشة Location settings→Accounts.
**الاستنتاج:** تأكيد إضافي على نفس القاعدة العامة بالنظام كله: **الأرشفة بدل الحذف الفعلي لأي كيان له تاريخ مالي مرتبط به** — نمط ثابت ومتكرر عبر كل الموديولات المالية والإدارية.

---

# 4. التراجع (Undo)

## 4.1 لا يوجد زر "Undo" عام بالنظام
**الملاحظة:** بعد مراجعة كل الشاشات، **لا يوجد أي زر Undo/Ctrl+Z عام**. بدلاً من ذلك، النظام يعتمد نمطين بديلين:
1. **Cancel صريح** لكل عملية له سجل مستقل (بيع، موعد).
2. **عملية عكسية موازية** بدل التراجع المباشر: مثال — بدل "التراجع عن Add money"، يوجد إجراء منفصل تمامًا لعكس الأثر (لو أضيف مبلغ للصندوق بالخطأ، يُصحَّح عبر Petty cash out بنفس القيمة، لا عبر "حذف" الحركة الأصلية).
**سبب الاستنتاج:** هذا يتماشى مع مبدأ **Immutable Ledger** (سجل غير قابل للتعديل) المتّبع بكل الأنظمة المحاسبية الجادة — كل حركة، صحيحة أو خاطئة، تبقى مسجّلة، والتصحيح يكون بحركة معاكسة جديدة، لا بمحو الحركة الأصلية. هذا يضمن **Audit trail** كامل غير قابل للتلاعب.

## 4.2 التراجع عن تغيير إعداد عام (Settings)
**الدليل المباشر:** كل شاشة إعدادات تقريبًا فيها زرا **"Cancel"** و**"Save"** منفصلين.
**كيف يُعالَج:** التراجع هون **وقائي (Pre-commit)** لا علاجي (Post-commit) — تقدر تلغي التعديل **قبل الحفظ**، لكن بعد الضغط على Save، لا يوجد "تراجع" مباشر إلا بالدخول وتغيير القيمة يدويًا مرة ثانية (باستثناء الحالات التي تملك زر Recalculate الصريح).

---

# 5. المرتجعات (Returns)

## 5.1 إرجاع منتج للمورّد
**الدليل المباشر:** تقرير/إجراء **"Return to supplier"** مذكور صراحة بشجرة Reports→Products، منفصل عن "Write-off products".
**كيف يُعالَج:** هذا **مسار منفصل تمامًا عن "الشطب" (Write-off)** — الفرق الجوهري: Write-off = تكلفة خسارة تتحملها المنشأة (تالف، منتهي الصلاحية)، بينما Return to supplier = **استرداد مالي أو استبدال من طرف ثالث**، وبالتالي له تأثير مختلف على "Balance of profitable storages" وعلى الحسابات مع المورّد (Payments to suppliers).

## 5.2 إرجاع منتج من الزبون (Refund لمنتج مُباع)
**الفجوة:** لا يوجد دليل مباشر بنافذة "Product return from client" منفصلة.
**الاستنتاج المرجّح:** الأقرب لآلية "Return to client" الظاهرة بـCash per day (مقابل "Remove credit") — يُرجَّح أن **"Return to client" هي الآلية العامة لأي استرداد مالي للزبون**، سواء كان سبب الاسترداد منتجًا مرتجعًا أو خدمة غير مُرضية أو خطأ بالفوترة، موصولة بحساب Cash drawer/Bank/Safe مثل أي حركة مالية أخرى. لكن **لا يوجد دليل مباشر لتحديث المخزون تلقائيًا** (إعادة الكمية للمخزن) عند إرجاع منتج تحديدًا — هذه فجوة حقيقية بالتوثيق المتاح، يُرجَّح أنها موجودة ضمن "Operations with product" لكن لم نفتحها بالتفصيل.

## 5.3 استرداد رصيد بطاقة/شهادة غير مُستخدمة بالكامل
**الفجوة:** لا يوجد دليل مباشر — الأقرب هو استخدام "Remove credit" لسحب المتبقي كنقد، لكن هذا **غير مؤكد** لأنه قد يتعارض مع كون الشهادة/البطاقة كيانًا منفصلًا عن Client Balance العام (Cards vs Balance منفصلان بملف الزبون، قسم 4.4 بالتحليل السابق).

## 5.4 إرجاع/إلغاء بيع بطاقة اشتراك بعد استخدام جزء منها
**السيناريو الأصعب بالنظام كله:** بطاقة اشتراك 12 شهر استُهلك منها 3 أشهر، والزبون يريد إلغاء الاشتراك واسترداد الباقي.
**التحدي المعماري:** بما أن "Distribute profit from membership card sales over the whole membership validity period" مُفعَّلة (قسم 2.4 بالملف السابق)، فإن جزءًا من الربح **مُوزَّع محاسبيًا مسبقًا على الأشهر المستقبلية غير المُستَهلَكة بعد**. إلغاء البطاقة بمنتصف مدتها يفرض **تصحيحًا محاسبيًا معقدًا**: عكس الأرباح "المُستقبلية" غير المُتحقَّقة فعليًا، وحساب القيمة المتبقية الفعلية للاسترداد. **لا يوجد دليل مباشر بالواجهة على وجود آلية مخصصة لهذا** — هذه أكبر فجوة استنتجناها بالنظام، وتوحي بأن هذا السيناريو إما (أ) نادر بما يكفي ليُعالَج يدويًا خارج النظام، أو (ب) موجود بشاشة لم نصل لها بعد.

---

# 6. الدفع الجزئي (Partial Payment)

## 6.1 دفع جزئي بالنقد والباقي بالرصيد/الدَين
**الدليل المباشر:** نظام "Maximum client's debt amount" + "Add to balance"/"Remove credit" منفصلان، ونظام Ticket يدعم على الأغلب **تعدد طرق الدفع بنفس الفاتورة** (يُستدل من وجود "Operations by payment type" كتقرير مستقل بشجرة Reports — لو كانت طريقة الدفع واحدة لكل فاتورة فقط، ما كان هذا التقرير له معنى تحليلي).
**كيف يُعالَج:** الجزء غير المدفوع نقدًا يتحول **تلقائيًا لدَين على الزبون** (يزيد Client's debt)، بشرط ألا يتجاوز "Maximum client's debt amount" — أي دفعة جزئية تتجاوز هذا السقف يُرجَّح أنها **تُمنع من قبل النظام** عند نقطة البيع، لا تُقبل ثم تُصحَّح لاحقًا (استنادًا لنص "the administrator can not increase the client's debt above the specified amount").

## 6.2 دفع فاتورة موظف (Salary) جزئيًا
**الدليل المباشر:** عمود **"Amount"** بجانب **"Balance"** بنافذة Salary payments — الحقلان منفصلان ومستقلان لكل موظف بنفس الجدول.
**كيف يُعالَج:** هذا **يدعم صراحة الدفع الجزئي**: الإداري يقدر يكتب مبلغًا أقل من "Balance" الكامل بحقل "Amount"، والفرق يبقى بـ"Balance at closing date" لتُرحَّل للفترة القادمة — هذا موثّق بشكل مباشر وواضح 100% بعكس معظم سيناريوهات هذا القسم.

## 6.3 دفع جزئي لفاتورة مورّد (Billing costs)
**الدليل المباشر:** "Add invoice for payment" منفصل عن "Add payment" ضمن نظام Billing costs.
**كيف يُعالَج:** بما أن الفاتورة (Invoice) والدفعة (Payment) كيانان منفصلان بالتصميم، فهذا **يدعم بطبيعته دفعات متعددة جزئية لنفس الفاتورة** بمرور الوقت — النظام يتتبع "المتبقي المستحق" تلقائيًا من الفرق بين مجموع الفواتير ومجموع الدفعات.

---

# 7. التسليم الجزئي (Partial Delivery)

## 7.1 استلام جزئي من طلب شراء (Purchase Request)
**الدليل المباشر:** تقارير منفصلة "Purchase requests" و"Products supply" و"Products supplied by suppliers" بشجرة Products.
**الاستنتاج:** فصل "الطلب" (Request) عن "التوريد الفعلي" (Supply) يوحي بدعم **استلام جزئي طبيعي**: لو طُلبت 100 قطعة ووصلت 60 فقط، فالنظام يُرجَّح أنه يسجّل "Products supply" بـ60 فقط، ويبقي الطلب الأصلي "مفتوحًا" جزئيًا حتى وصول الباقي — هذا استنتاج معماري معقول (شائع بأي نظام Purchase Order/Goods Receipt منفصلين)، لكن **لم نشاهد شاشة استلام فعلية بالتفصيل** لتأكيد آلية العمل بالضبط.

## 7.2 تنفيذ خدمة جماعية (Group) بحضور جزئي من المسجّلين
**الدليل المباشر:** "Remove missed group visits from card" (Settings→Cards)، وتحذيره الصريح: *"recalculate... attendance balances on all client cards... for all missed group sessions"*.
**كيف يُعالَج:** لو حضر 5 من أصل 8 مسجّلين بجلسة جماعية، فالـ3 الغائبين **قد يُخصم أو لا يُخصم من رصيد جلساتهم** بالبطاقة حسب هذا الإعداد بالتحديد — يعني "التسليم الجزئي" لخدمة جماعية (حضور بعض المسجّلين لا كلهم) **له قاعدة عمل صريحة وقابلة للتهيئة**، وليس سلوكًا عشوائيًا.

## 7.3 تسليم/استخدام جزئي لكارت "Subscription to service" (اشتراك بعدد جلسات محدد)
**الدليل المباشر:** خيار **"Quantity is not limited"** بنموذج Subscription to service — يعني الافتراض الآخر (غير محدد) هو وجود **كمية محدودة قابلة للاستهلاك التدريجي**.
**كيف يُعالَج:** كل استخدام يُخصم رصيدًا واحدًا من الكمية الكلية للاشتراك — استهلاك جزئي مستمر عبر الزمن، موثّق تلقائيًا بعمود "Visits on cards" (Reports).

---

# 8. الأخطاء المحتملة (Potential Errors) — تحليل استباقي

## 8.1 أخطاء تصادم الحجز (Double booking)
**الحماية الموجودة:** "Prohibit simultaneous booking" (Zones and halls) يمنع تصادم استخدام نفس الغرفة، لكن **لا يوجد دليل مباشر مطابق لمنع تصادم نفس الموظف بموعدين متزامنين** — قد يكون هذا مضمونًا تلقائيًا بمنطق Appointment book غير الظاهر بالكامل بالواجهة (الأرجح أنه يُمنع تلقائيًا بحكم أن الموظف عمود واحد بالكاليندر لا يقبل صفين متطابقين بالوقت)، لكنه **افتراض لا دليل قاطع عليه**.

## 8.2 خطأ إدخال بيانات مصرفية/SMS/Email خاطئة
**الحماية الموجودة:** زر **"Test connection"** (Sending E-mail messages) وزر **"Print test receipt"** (Optional equipment→Receipt printer) — النظام يوفر **آليات تحقق استباقية (Pre-flight checks)** قبل الاعتماد الفعلي على هذه الإعدادات بعمليات حقيقية، لتفادي اكتشاف الخطأ فقط بعد فشل إرسال رسالة حقيقية لزبون.

## 8.3 خطأ تجاوز حد الخصم المسموح
**الحماية الموجودة:** "Maximum discount" + نص صريح "administrator can't give discount greater than specified" — هذا **قيد يُفرَض عند الإدخال (Input validation)**، لا يُكتشف لاحقًا بتقرير، أي أن النظام **يمنع الخطأ من الحدوث أصلاً** بدل رصده بعد وقوعه.

## 8.4 خطأ التلاعب بالحضور (Buddy Punching)
**الحماية الموجودة:** التنويه الصريح بخصوص Fingerprints' reader (أوثق من البطاقة لأنها لا تُنسَخ) — دليل مباشر أن النظام **يفترض هذا الخطأ/الاحتيال محتمل الحدوث** ويقدّم حلاً تقنيًا مخصصًا له.

## 8.5 خطأ حساب الراتب بسبب تغيير قاعدة الحساب دون تحديث البيانات القديمة
**نقطة ضعف حقيقية مستنتجة:** بما أن Recalculate عملية **يدوية اختيارية** (قسم 2.2 أعلاه)، فإن أكبر خطأ تشغيلي متوقع هو: صاحب صالون يُعدِّل Payment Plan لموظف، ينسى الضغط على "Recalculate"، ويكتشف لاحقًا أن رواتب الفترة الماضية لم تتحدث فعليًا كما توقع. **هذا خطر تصميمي حقيقي وليس افتراضًا نظريًا فقط**، لأن الاعتماد الكامل على تدخل يدوي بعملية حساسة كهذي، بدون تنبيه استباقي واضح ("لديك بيانات لم تُعاد حسبتها")، عرضة للخطأ البشري.

## 8.6 خطأ ازدواجية سجل الزبون (Duplicate Client)
**الحماية الموجودة:** تقرير "Duplicate clients" + "Merge client" — النظام **لا يمنع** الازدواجية وقت الإدخال (لم نشاهد تحذير "هذا الرقم مسجّل مسبقًا" عند إضافة زبون)، بل **يكتشفها بعديًا عبر تقرير** ويعالجها بالدمج. هذا يعني الحماية **علاجية (Reactive) لا وقائية (Preventive)** لهذا الخطأ تحديدًا، بعكس خطأ تجاوز حد الخصم (وقائي).

## 8.7 خطأ فشل إرسال رسالة تلقائية (SMS/Email) بسبب انتهاء رصيد المزوّد
**الفجوة:** لا يوجد دليل مباشر لآلية "إعادة محاولة" (Retry) أو تنبيه فوري لصاحب الصالون عند فشل إرسال جماعي — الدليل الوحيد المتاح هو عمودا "Sent" و"Delivered" منفصلان بجدول SMS notification، ما يعني النظام **على الأقل يسجّل الفشل** ويُظهره بالفرق بين الرقمين، لكن **لا دليل على معالجة تلقائية للفشل** (كإعادة الإرسال لاحقًا).

---

# 9. الخلاصة: فلسفة معالجة الاستثناءات بالنظام

بجمع كل ما سبق، تظهر **3 مبادئ ثابتة** يتّبعها النظام بكل سيناريو استثنائي تقريبًا:

1. **لا حذف فعلي أبدًا لأي كيان له تاريخ مالي أو تشغيلي** — فقط أرشفة/تعطيل. هذا يحمي سلامة كل التقارير والـLedger المالي بشكل كامل.
2. **الإلغاء والتصحيح دائمًا "حركة مسجَّلة إضافية"، لا محو للحركة الأصلية** — يحافظ على Audit trail غير قابل للتلاعب، مهم جدًا للامتثال الضريبي بالدول التي تفرض Fiscal registrar.
3. **أي عملية "بأثر رجعي" على بيانات تاريخية تتطلب فعلًا صريحًا وواعيًا من المستخدم (Recalculate/تأكيد بنافذة تحذير)**، لا تحديثًا صامتًا تلقائيًا — يمنع مفاجآت مالية غير مقصودة، لكنه يخلق اعتمادًا على انضباط المستخدم بتذكّر تنفيذها (أضعف حلقة بالتصميم بأكمله).

أكبر فجوتين حقيقيتين غير موثقتين بالواجهة المتاحة: **آلية استرداد بطاقة اشتراك مستهلكة جزئيًا** (تعقيد محاسبي حقيقي لم نجد له حلاً واضحًا)، و**آلية استلام جزئي من مورّد** (يُرجَّح دعمها معماريًا لكن دون شاشة مؤكدة شاهدناها).
-e 

---

<div style="page-break-after: always;"></div>

# ═══════════════════════════════════════════
# القسم 5: التقييم الشامل (SWOT) والمقارنة مع Odoo
# ═══════════════════════════════════════════

# التقييم الشامل النهائي — نظام Beauty Pro
## نقاط القوة | نقاط الضعف | المخاطر | فرص التطوير | التقييم الكمي والمقارنة مع Odoo

> هاد التقييم مبني على تحليل معمّق لأكثر من 20 موديول وشجرة إعدادات كاملة وشجرة تقارير (~90 تقرير)، من موقع **مهندس/مستشار أنظمة ERP** لا مستخدم عادي. الحكم هون تقني وتجاري صريح، بدون مجاملة.

---

# 1. نقاط القوة (Strengths)

## 1.1 نموذج محاسبي صحيح فعليًا (Accrual + Revenue Recognition)
النظام لا يتعامل مع المال كـ"رقم يتحرك"، بل كـLedger حقيقي: عمود "Balance at start/Charge/Paid/Balance at closing" مطبَّق بثبات على الموظفين (Salary) واليوميات (Cash per day). وقرار توزيع أرباح بطاقة الاشتراك على كامل مدة صلاحيتها (لا دفعة واحدة يوم البيع) هو تطبيق دقيق لمبدأ Revenue Recognition — قرار محاسبي متقدم نادر بأنظمة عمودية بهذا الحجم.

## 1.2 إعادة استخدام حقيقية للمكوّنات على مستوى الـBackend (مو الواجهة فقط)
نفس الـDialog بالضبط (Remove credit، Add to balance) يظهر من نقطتي دخول مختلفتين (Clients وCash per day) بدون أي فرق. نفس منطق "Graduated commission" مُعاد استخدامه بـ3 سياقات مختلفة. Award/Fine/Taxes الثلاثة يفتحون نفس النافذة تمامًا. هذا دليل على **Entity واحد بقاعدة البيانات، لا نسخ متعددة مكرّرة بالكود** — جودة هندسية حقيقية.

## 1.3 نظام صلاحيات (RBAC) بمستوى الحقل لا الشاشة فقط
"View and edit purchase prices" منفصلة عن صلاحية الوصول العامة للمنتجات. "Correction of data for past days" صلاحية مستقلة. صلاحيات الموبايل شجرة كاملة منفصلة عن سطح المكتب. هذا مستوى دقة نادر نشوفه حتى بأنظمة أكبر بكثير.

## 1.4 نمذجة عمق فعلي لخصوصية القطاع (Vertical depth)
الفصل بين 4 أدوار بونص مختلفة (Professional/Administrator/Manager/Service manager) يعكس واقع تشغيلي حقيقي لصالونات لا يوجد بأي ERP عام. مفهوم Backbar منفصل عن سعر البيع (COGS دقيق)، ونظام Zones and halls كبُعد ثالث للجدولة (موظف+مكان+زبون)، ونظام "Tanning bed cooling time" و"Epilation power/diameter" — تفاصيل تشغيلية دقيقة لصناعة التجميل تحديدًا لا نجدها بأي حل عام.

## 1.5 حماية بيانات تاريخية صارمة (Immutability by Design)
لا يوجد حذف فعلي لأي كيان له تاريخ (Archive فقط)، ولا تعديل صامت لبيانات ماضية (يتطلب صلاحية + Recalculate صريح مع تحذير). هذا يضمن Audit trail موثوق للامتثال الضريبي.

## 1.6 معمارية SaaS نظيفة وقابلة للتضمين
Widget الحجز الأونلاين مبني كـJavaScript module حقيقي (`init({database: 653083})`)، قابل للتضمين بأي موقع خارجي، مع تكامل Facebook/Instagram وGoogle Analytics. هذا مستوى تقني احترافي يوازي منتجات SaaS متخصصة قائمة بذاتها (زي Calendly أو Fresha).

## 1.7 توطين جغرافي حقيقي لا سطحي
دعم Fiscal registrar لدول محددة (Ukraine, Kazakhstan, Kyrgyzstan...)، عملات متعددة، مزوّدي SMS/Email إقليميين، لغات واجهة حجز منفصلة عن لغة النظام الداخلي — دليل على استثمار حقيقي بالتوسع الجغرافي لا مجرد ترجمة سطحية.

---

# 2. نقاط الضعف (Weaknesses)

## 2.1 تشتت منظومة الولاء/البونص لـ4 أنظمة متوازية بلا محرك موحّد
Bonus card + Accumulative card + Sale bonuses + Campaign "Bring your friend" — أربعة أنظمة منفصلة، كل واحد له منطق حساب وشرط تفعيل خاص، وبدون طبقة واحدة تدير "كل بونصات الزبون" بمكان مركزي. هذا نتاج **Feature Accretion** (تراكم ميزات بمرور الوقت بدون Refactoring)، ويخلق تعقيدًا إعداديًا حقيقيًا لصاحب الصالون الجديد.

## 2.2 الاعتماد الكلي على الفعل اليدوي بعمليات حساسة (Recalculate)
تغيير Payment Plan أو قاعدة حساب لا يُطبَّق تلقائيًا على البيانات السابقة، بل يتطلب ضغط "Recalculate" يدويًا. لا يوجد أي تنبيه استباقي ("لديك بيانات لم تُحدَّث")، ما يجعل هذا أضعف حلقة تشغيلية بالنظام كله — خطأ بشري متوقع الحدوث بشكل شبه مؤكد.

## 2.3 فجوات حقيقية بسيناريوهات مالية معقدة
لا آلية واضحة موثقة لاسترداد بطاقة اشتراك مُستهلَكة جزئيًا (تحدٍ محاسبي حقيقي بسبب توزيع الأرباح المسبق). لا آلية موثقة صراحة لإرجاع منتج من الزبون مع تحديث المخزون تلقائيًا.

## 2.4 جودة تدويل (i18n) غير مكتملة
Tooltips ظهرت بالروسية غير مترجمة وسط واجهة إنجليزية بالكامل. نص placeholder ظهر حرفيًا "(Gender)" بدل القيمة الفعلية. أخطاء صغيرة لكنها تتراكم وتترك انطباعًا غير احترافي لمنتج يُسوَّق دوليًا.

## 2.5 قفل جغرافي صارم (Country Lock-in)
"Country is set on database creation and can't be changed" — قرار مفهوم لأسباب ضريبية لكنه غير مرن، يفرض إعادة إنشاء قاعدة بيانات كاملة (خسارة كل التاريخ) لو أراد صالون الانتقال لدولة أخرى.

## 2.6 تسرّب مصطلحات من منصة عامة مشتركة
"Waiter workplace" (مصطلح مطاعم) ظاهر بإعدادات صالون تجميل — دليل أن النظام مبني فوق منصة POS عامة مشتركة بين عدة قطاعات (صالونات + مطاعم + أندية رياضية)، وهذا اقتصاديًا ذكي لكنه يخلق مخاطرة تسرّب منطق أو مصطلحات غير مصممة أصلاً لهذا القطاع.

## 2.7 تعدد نقاط دخول لنفس المفهوم دون توحيد واجهة الإدخال
"Department" يظهر كإعداد عام (Settings)، لكن أيضًا كخيار افتراضي بكل نموذج تسويقي (Cards/Certificates/Promotions) دون رابط واضح بصري بينهم لمستخدم جديد — يحتاج فهمًا تراكميًا للنظام (تمامًا كما احتجناه نحن بالتحليل) بدل أن يكون بديهيًا من الشاشة نفسها.

---

# 3. المخاطر (Risks)

## 3.1 مخاطرة تشغيلية: أخطاء حساب رواتب صامتة
بسبب الاعتماد على Recalculate اليدوي (2.2)، أكبر خطر تشغيلي متكرر: صاحب صالون يُعدّل خطة راتب موظف، ينسى الضغط على Recalculate، ويكتشف بنهاية الشهر أن الأرقام غير صحيحة — نزاع محتمل مع الموظف، وتأخير بالثقة بالنظام.

## 3.2 مخاطرة قانونية/ضريبية بالأسواق غير المدعومة بـFiscal registrar
أي صالون بدولة خارج القائمة المدعومة (كحالتنا بفلسطين بالـDemo) يبقى بدون فوترة ضريبية معتمدة رسميًا — مخاطرة امتثال حقيقية لو الدولة المعنية بدأت تفرض فوترة إلكترونية إلزامية لاحقًا والنظام لم يواكبها بالتوقيت المناسب.

## 3.3 مخاطرة أمنية من مركزية النسخ الاحتياطي
"Backup managed entirely by AI Helps" (لا خيار Self-service Restore) يعني اعتمادًا كاملاً على استجابة الدعم الفني للشركة وقت الأزمة — أي تأخير بالاستجابة = توقف تشغيلي كامل للصالون بدون بديل داخلي.

## 3.4 مخاطرة تعقيد الإعداد الأولي (Onboarding Complexity)
مع 4 أنظمة ولاء متوازية + Payment Plans مرنة جدًا + RBAC بمستوى الحقل، صاحب صالون جديد بدون خلفية تقنية معرّض بقوة لإعداد خاطئ (مثال: تفعيل بونص مزدوج بالخطأ عبر نظامين مختلفين بنفس الوقت) — المرونة العالية سلاح ذو حدين.

## 3.5 مخاطرة الاعتماد الكامل على مزوّد خارجي واحد لكل قناة تواصل
لا يوجد Fallback تلقائي لو فشل مزوّد SMS/Email المُختار (رصيد منتهي، Downtime) — النظام يسجّل الفشل (Sent/Delivered) لكن بدون إعادة محاولة تلقائية موثقة، ما يعني احتمال ضياع رسائل تذكير حساسة (موعد، بونص منتهي) بصمت.

## 3.6 مخاطرة تنافسية: منافسون متخصصون أسرع وأخف
منتجات مثل Fresha وBooksy وVagaro متخصصة **حصريًا** بقطاع الجمال، بواجهة أبسط بكثير وتركيز تسويقي أقوى بالحجز الأونلاين — Beauty Pro أعمق تقنيًا لكن قد يبدو "أثقل" لصالون صغير يريد فقط حجزًا وفوترة بسيطة.

---

# 4. فرص التطوير (Development Opportunities)

## 4.1 بناء "Loyalty Rules Engine" موحّد
دمج Bonus card + Accumulative card + Sale bonuses + Bring a friend تحت Data Model واحد بمحرك شروط (Trigger) عام واحد — يقلل التعقيد الإعدادي، ويسمح لصاحب الصالون برؤية "كل بونصات نظامي" بشاشة واحدة بدل 4.

## 4.2 نظام تنبيه استباقي لـ"بيانات تحتاج Recalculate"
بدل الاعتماد الكامل على تذكّر المستخدم، إضافة Badge/تنبيه تلقائي: "هناك تغييرات بخطط الرواتب لم تُطبَّق على بيانات الفترة الحالية — اضغط هنا لإعادة الحساب". يحل أكبر نقطة ضعف تشغيلية بالنظام بجهد تطوير بسيط نسبيًا.

## 4.3 محرك استرداد مالي موحّد (Unified Refund Engine)
بناء منطق واحد يغطي كل حالات الاسترداد (منتج، خدمة، بطاقة اشتراك جزئية، شهادة) مع حساب تلقائي للقيمة المتبقية العادلة، بدل الاعتماد على معالجة يدوية خارج النظام لحالات معقدة كإلغاء اشتراك بمنتصف مدته.

## 4.4 Fallback تلقائي متعدد المزوّدين لقنوات التواصل
لو فشل مزوّد SMS الأساسي، تحويل تلقائي لمزوّد احتياطي (لو مُهيَّأ) بدل فشل صامت — يرفع موثوقية الإشعارات التلقائية الحرجة (تذكير موعد، انتهاء بونص).

## 4.5 مرونة أكبر بتغيير الدولة (Migration Path لا إعادة إنشاء كامل)
بدل القفل الكامل، بناء مسار Migration مُدار (يحافظ على التاريخ، يعيد ضبط الإعدادات الضريبية فقط) لصالون ينتقل جغرافيًا أو يتوسع بدولة جديدة بنفس الحساب.

## 4.6 تحسين جودة QA للتدويل
مراجعة شاملة لكل الـTooltips والنصوص الديناميكية بكل اللغات المدعومة قبل كل إصدار — أمر تنفيذي بسيط نسبيًا لكنه يرفع الانطباع الاحترافي بشكل ملحوظ.

## 4.7 تبسيط تجربة الإعداد الأولي عبر "وضع مبتدئ / وضع متقدم"
إخفاء التعقيد الإضافي (RBAC الدقيق، Payment Plans المتقدمة، 4 أنظمة ولاء) خلف "Advanced mode" اختياري، وعرض إعدادات مبسطة افتراضيًا لصاحب الصالون الصغير الذي لا يحتاج كل هذا العمق من اليوم الأول.

---

# 5. التقييم الكمي والمقارنة مع Odoo

## منهجية التقييم
التقييم على 6 أبعاد، كل بُعد من 100%، ثم معدّل مرجّح. المقارنة مع Odoo تحديدًا بصفته **ERP عام شامل (Horizontal)**، بينما Beauty Pro **ERP عمودي متخصص (Vertical)** — المقارنة ليست "أيهما أفضل مطلقًا"، بل "أيهما أنسب لأي سياق".

| البُعد | Beauty Pro | Odoo (عام) | التبرير |
|---|---|---|---|
| **العمق القطاعي (Vertical fit)** | 92% | 45% | Odoo يحتاج تخصيصًا (Customization/Studio) شهور ليصل لعمق Payment Plans وBackbar وZones الموجودة جاهزة بـBeauty Pro |
| **سلامة النموذج المحاسبي (Accounting integrity)** | 80% | 90% | Odoo محاسبته أعمق وأكثر مرونة قانونيًا (Multi-GAAP)، لكن Beauty Pro قوي بما يكفي لصناعته المستهدفة |
| **توحيد المعمارية (Architectural cohesion)** | 65% | 85% | Odoo مبني بنمط Modules موحّد صارم (كل شي Model/Field بمعيار واحد)؛ Beauty Pro فيه تكرار مفاهيمي واضح (4 أنظمة ولاء) |
| **سهولة الاستخدام للمستخدم النهائي (UX for SMB owner)** | 78% | 55% | Beauty Pro مصمم لصاحب صالون مباشرة (Setup Wizard بسيط، افتراضات مسامحة)؛ Odoo يحتاج Implementation Partner غالبًا |
| **قابلية التوسع/التخصيص (Extensibility)** | 50% | 95% | Odoo مفتوح المصدر بالكامل، آلاف الـModules الإضافية، API مفتوح؛ Beauty Pro مغلق، تخصيصه محدود بما توفره الشركة |
| **جاهزية التكامل الخارجي (Integrations)** | 75% | 90% | Odoo يتكامل مع كل شيء تقريبًا (Marketplace ضخم)؛ Beauty Pro تكامله محصور بأجهزة/مزوّدين محددين مسبقًا لكن عميق بما يخص القطاع |

### النتيجة الإجمالية المرجّحة

**Beauty Pro: 73% من ناحية "التكامل وحسن الاستخدام" لسياقه المستهدف (صالون تجميل صغير-متوسط)**

**Odoo: 78% كنظام عام، لكن ينخفض إلى ~40-50% فعليًا في نفس سياق "صالون تجميل" بدون استثمار تخصيص كبير**

## الخلاصة المقارنة الصريحة

لو السؤال هو **"أي نظام تكامله أفضل بشكل مطلق؟"** — الجواب Odoo، بلا نقاش، من ناحية عمق البنية التحتية المحاسبية والتقنية وقابلية التوسع اللانهائية (نظام مفتوح المصدر بمجتمع مطورين ضخم).

لكن لو السؤال هو **"أيهما أفضل تكاملًا وسهولة استخدام لصاحب صالون تجميل تحديدًا، من اليوم الأول، بدون فريق تقني؟"** — الجواب **Beauty Pro بفارق واضح**. لأن Odoo بحالته الافتراضية (Vanilla) لا يعرف أصلاً مفهوم "Backbar" أو "Professional's bonus" أو "Tanning bed cooling time" — كل هذا يحتاج بناءه من الصفر بـOdoo Studio أو Custom Module، بتكلفة وقت ومال لا يتحملها صالون صغير عادةً.

**الحكم النهائي كخبير:** Beauty Pro ليس Odoo أصغر، هو **حل عمودي (Vertical SaaS) ناضج فعليًا بمنطقة عمله المحددة**، بتكلفة معمارية حقيقية هي **تراكم ميزات غير موحّد بمرور الوقت** (خصوصًا بمنظومة الولاء) وقفل تقني على مزوّد واحد بدل نظام مفتوح. لو أردت تقييمًا برقم واحد نهائي مجرّد من السياق: **73/100** — نظام قوي جدًا بجوهره، ينقصه توحيد داخلي وتنبيهات استباقية أكثر ليصل لممتاز.
-e 

---

<div style="page-break-after: always;"></div>

# ═══════════════════════════════════════════
# القسم 6: أفكار دمج الذكاء الاصطناعي
# ═══════════════════════════════════════════

# دمج الذكاء الاصطناعي في نظام Beauty Pro
## أفكار عملية مبنية على الموديولات والبيانات الفعلية الموجودة بالنظام (لا أفكار عامة/نظرية)

> كل فكرة هون مبنية على **بيانات وميزة موجودة فعليًا بالنظام** (وثّقناها بالتحليل السابق)، مو اقتراحات عامة. الهدف: أقصى عدد ممكن من الأفكار القابلة للتنفيذ فعليًا، مرتبة حسب الموديول، مع توضيح **من أين تُستخرج البيانات اللازمة** ولماذا الفكرة عملية تحديدًا بهاد النظام.

---

# 1. الذكاء الاصطناعي بموديول Clients

### 1.1 تنبؤ بمخاطر فقدان الزبون (Churn Prediction)
**البيانات المتاحة:** Client history (تواتر الزيارات)، حالة "former" التلقائية، "Client retention" بـDashboard، "Lost clients" بـReports.
**الفكرة:** نموذج ML يحلل نمط زيارات كل زبون (تباعد الزيارات، متوسط الفاتورة، آخر خدمة) ويُصنّف زبائن "active" حسب احتمال تحوّلهم لـ"former" قبل حدوثه فعليًا — تنبيه استباقي للإداري بدل انتظار مرور فترة الغياب المحددة بـSettings.

### 1.2 تحسين استهداف "Reminder if client hasn't visited for a while"
**البيانات المتاحة:** الإعداد الحالي (30 يوم ثابت لكل الزبائن).
**الفكرة:** استبدال الرقم الثابت (30 يوم) بعتبة **ديناميكية لكل زبون** يحسبها الذكاء الاصطناعي حسب نمط تردده الطبيعي (زبون يزور كل 45 يوم عادة لا يُذكَّر بعد 30 يوم فقط، بل بعد تجاوز نمطه المعتاد بفارق منطقي).

### 1.3 كشف الزبائن المكررين تلقائيًا (تحسين "Duplicate clients")
**البيانات المتاحة:** تقرير Duplicate clients الحالي (يعتمد غالبًا على تطابق الاسم/الهاتف الحرفي).
**الفكرة:** نموذج Fuzzy matching/NLP يكتشف تكرارات غير حرفية (اختلاف بسيط بالإملاء، رقم هاتف بصيغة مختلفة، اسم بالعربي مقابل بالإنجليزي) ويقترح دمجًا تلقائيًا بثقة عالية أو يرفعها كاقتراح للمراجعة.

### 1.4 تصنيف تلقائي ذكي لفئة الزبون (تجاوز "Automatic assignment category clients")
**البيانات المتاحة:** آلية Trigger الحالية لتصنيف الزبائن تلقائيًا (شروط ثابتة يدوية).
**الفكرة:** بدل شروط ثابتة يدخلها الإداري، نموذج يحلل السلوك الكامل (الإنفاق، التكرار، الحساسية للخصومات) ويقترح تصنيف "VIP محتمل" أو "معرّض للمغادرة" تلقائيًا، مع إمكانية اعتماد الاقتراح أو رفضه.

### 1.5 تلخيص ذكي لملف الزبون قبل الجلسة
**البيانات المتاحة:** Client History الكامل + Files المرفقة.
**الفكرة:** عند فتح ملف الزبون قبل موعد قريب، توليد ملخص نصي تلقائي (بالـLLM) لأهم ما يحتاج الأخصائي معرفته: "آخر زيارة كانت صبغة، اشتكت من حساسية بالفروة، تفضّل درجة لون أفتح، لديها بونص ينتهي خلال أسبوعين".

---

# 2. الذكاء الاصطناعي بموديول Appointment Book / Online Booking

### 2.1 تحسين "Enable auto mode" (تقليل فجوات الجدول) بخوارزمية تعلّم آلي حقيقية
**البيانات المتاحة:** الميزة موجودة فعلًا لكن كخيار تفعيل بسيط، منطقها الداخلي غير واضح إن كان قواعديًا بسيطًا أو ذكيًا.
**الفكرة:** استبدال/تعزيز المنطق بنموذج Optimization فعلي (شبيه بـ"Bin packing") يقترح على الزبون بالحجز الأونلاين أوقاتًا محددة **مصمَّمة لتقليل الفجوات الفارغة بجدول الموظف**، لا مجرد عرض كل الأوقات الشاغرة بشكل متساوٍ.

### 2.2 توقّع الحجوزات "No-show" قبل حدوثها
**البيانات المتاحة:** تقرير "Cancelled and no-show visits"، تاريخ الزبون بالحضور/الإلغاء.
**الفكرة:** نموذج تصنيف يعطي كل حجز جديد "درجة خطر عدم حضور" بناءً على تاريخ الزبون (زبون سبق وألغى 3 مرات متتالية = خطر مرتفع)، لتفعيل إجراء استباقي (طلب تأكيد إضافي، أو دفع عربون جزئي عبر الحجز الأونلاين تحديدًا لهذا الزبون).

### 2.3 مساعد حجز بالمحادثة الطبيعية (Conversational Booking Agent)
**البيانات المتاحة:** Widget الحجز الأونلاين الحالي (نموذج تفاعلي بخطوات: Service→Professional→Date).
**الفكرة:** إضافة واجهة محادثة (Chat) فوق نفس الـWidget تسمح للزبون يكتب "بدي موعد صبغة يوم خميس بعد الظهر" ويحوّلها الذكاء الاصطناعي لنفس معايير البحث المهيكلة تلقائيًا — يقلل خطوات الحجز دون تغيير البنية التحتية.

### 2.4 اقتراح "Additional sales" ذكي وقت الحجز لا وقت البيع فقط
**البيانات المتاحة:** ميزة Additional sales الموجودة (Settings→Additional modules) وتاريخ مشتريات الزبون.
**الفكرة:** بدل توصيات عامة، نموذج توصية (Recommendation engine بأسلوب Collaborative filtering) يقترح خدمة/منتج إضافي وقت **تأكيد الحجز نفسه** بناءً على أنماط زبائن مشابهين اشتروا نفس الخدمة، ما يرفع "Average bill" قبل وصول الزبون أصلاً.

---

# 3. الذكاء الاصطناعي بموديول Salary / Employees

### 3.1 كشف شذوذ بالحضور (Anomaly Detection على Check-in log)
**البيانات المتاحة:** Check-in log عبر Fingerprints' reader، Schedule for month (عمود "Fact" مقابل المخطط).
**الفكرة:** نموذج يكتشف أنماطًا غير طبيعية (تأخر متكرر بنفس اليوم من الأسبوع، خروج مبكر متكرر) ويرفعها كتنبيه بدل انتظار مراجعة يدوية شهرية.

### 3.2 تنبيه استباقي ذكي بـ"بيانات تحتاج Recalculate"
**البيانات المتاحة:** آلية Recalculate اليدوية الحالية (أضعف نقطة تشغيلية وثّقناها بالتحليل السابق).
**الفكرة:** ليس بالضرورة ذكاءً اصطناعيًا متقدمًا، لكن طبقة "قواعد ذكية" تراقب أي تغيير على Payment Plan/Discount rules وتقارنه ببيانات مبيعات لم تُعَد حسبتها، وتُصدر تنبيهًا فوريًا. حل مباشر لأخطر فجوة رصدناها بالنظام.

### 3.3 اقتراح جدول دوام محسَّن (Smart Scheduling) بناءً على تنبؤ الطلب
**البيانات المتاحة:** Workload by time، Today's appointments، Scheduled visits بـDashboard (رسم بياني يومي).
**الفكرة:** نموذج تنبؤ بالطلب (Demand forecasting) يحلل أنماط الحجز التاريخية (أيام الذروة، مواسم معينة) ويقترح تلقائيًا جدول دوام أسبوعي محسَّن لكل موظف يقلل ساعات الخمول ويغطي الذروة.

### 3.4 تحسين توزيع Payment Plans تلقائيًا لتقليل الاحتيال المحتمل
**البيانات المتاحة:** إعداد "Calculate salary for employees sales: from price for employees / from original price".
**الفكرة:** نموذج يراقب معدل "مبيعات الموظف لنفسه" مقارنة بزملائه بنفس الدور، ويرفع تنبيهًا لو تجاوز نمطًا طبيعيًا (مؤشر محتمل على استغلال هذا الخيار للتحايل على الراتب).

---

# 4. الذكاء الاصطناعي بموديول Marketing

### 4.1 تحسين محرك "Promotions → Trigger" ليصبح ذكيًا لا قاعديًا ثابتًا فقط
**البيانات المتاحة:** نظام Trigger الحالي (شروط يدوية ثابتة).
**الفكرة:** نموذج يقترح **متى وعلى من** يجب إطلاق عرض ترويجي معيّن تلقائيًا (بدل انتظار الإداري ليضبط الشرط يدويًا) — مثال: كشف انخفاض مؤقت بالحجوزات ليوم معين بالأسبوع، واقتراح عرض مخفَّض تلقائي لذلك اليوم تحديدًا.

### 4.2 توليد نصوص رسائل تسويقية (SMS/Email) بالذكاء الاصطناعي التوليدي
**البيانات المتاحة:** كل النظام الحالي للرسائل (Birthday greetings، Request for review، Reminder if client hasn't visited) يعتمد على نص ثابت مع Placeholders.
**الفكرة:** استبدال النص الثابت بتوليد نص مخصص ديناميكيًا لكل زبون (نبرة مختلفة لزبون VIP عن زبون عادي، لغة أكثر دفئًا لزبون قديم غاب فترة طويلة) — يستخدم نفس الـPlaceholders الموجودة كمدخلات لنموذج التوليد.

### 4.3 محرك ولاء موحّد ذكي (يحل مشكلة التشتت بين 4 أنظمة بونص)
**البيانات المتاحة:** Bonus card + Accumulative card + Sale bonuses + Bring a friend (أربعة أنظمة منفصلة رصدناها بالتحليل السابق).
**الفكرة:** طبقة ذكاء اصطناعي فوق الأربعة تقترح لصاحب الصالون تلقائيًا "أي نوع بونص الأنسب لكل زبون" بناءً على سلوكه (زبون حساس للسعر → Discount card، زبون اجتماعي كثير التوصية → تحفيز Bring a friend أكثر) — بدون الحاجة لإعادة بناء الأنظمة الأربعة من الصفر.

### 4.4 تحليل مشاعر (Sentiment Analysis) لـ"Clients feedbacks"
**البيانات المتاحة:** Request for review + Visit feedbacks/Feedbacks about institution (Reports)، حاليًا مبنية على تقييم نجوم فقط.
**الفكرة:** لو أُضيف حقل نص حر بالتقييم، تحليل المشاعر تلقائيًا (Sentiment/NLP) لاستخراج أسباب الرضا/الاستياء الفعلية (مثال: "الانتظار طويل" مقابل "السعر مرتفع") وتصنيفها تلقائيًا لتغذية "Services rating"/"Professionals rating" بـDashboard بمعنى أعمق من رقم نجوم فقط.

---

# 5. الذكاء الاصطناعي بموديول Products / Cash per day

### 5.1 تنبؤ بالطلب على المخزون (Demand Forecasting لـ"Low supply")
**البيانات المتاحة:** Products remaining، Low supply، Flow of products، Purchase requests.
**الفكرة:** نموذج تنبؤ يحلل معدل استهلاك كل منتج (مرتبط بعدد الحجوزات المتوقعة من Appointment book) ويقترح "Order products" تلقائيًا قبل الوصول لعتبة "Low supply"، بدل التنبيه بعد حدوثها.

### 5.2 كشف احتيال/تسريب بالصندوق اليومي (Anomaly Detection على Cash per day)
**البيانات المتاحة:** Petty cash out، Add money، Operations history اليومية.
**الفكرة:** نموذج يراقب أنماط "Petty cash out" و"Add money → Other income" ويرفع تنبيهًا لو ظهر نمط غير معتاد (مبالغ متكررة بنفس القيمة من نفس الإداري بأوقات غير اعتيادية) — طبقة حماية إضافية فوق الاعتماد الكلي على الرقابة اليدوية.

### 5.3 تسعير ديناميكي ذكي (Dynamic Pricing) بدل التسعير الثابت
**البيانات المتاحة:** "Automatically calculate the sale price of products from the current purchase price"، Workload by time (أوقات الذروة).
**الفكرة:** توسيع نفس منطق التسعير التلقائي الموجود ليشمل **تسعير الخدمات حسب الطلب** (سعر أعلى بسيط لأوقات الذروة المؤكدة، أو خصم تلقائي لأوقات الخمول المعروفة) — مشابه لمنطق Uber/الفنادق، لكن بحدود معقولة يضبطها صاحب الصالون.

---

# 6. الذكاء الاصطناعي بموديول Reports / Dashboard

### 6.1 تحليل استباقي ذكي بدل التقارير الوصفية فقط
**البيانات المتاحة:** ~90 تقرير موجود، كلها Descriptive (تصف الماضي).
**الفكرة:** طبقة "Insights" فوق شجرة Reports تولّد تلقائيًا ملاحظات نصية (بالـLLM) من الأرقام الخام: "إيراد قسم Massage انخفض 15% هذا الشهر مقارنة بالشهر السابق، ويتزامن مع زيادة الإلغاءات لنفس القسم" — بدل ترك صاحب الصالون يقرأ الأرقام ويستنتج بنفسه.

### 6.2 استكمال "Services rating / Professionals rating" الفارغة بذكاء
**البيانات المتاحة:** الحالة الحالية "Still empty — We do not have enough data" لما البيانات قليلة.
**الفكرة:** بدل انتظار بيانات كافية بشكل صارم، نموذج يقدّم تقديرًا أوليًا موثوقًا جزئيًا (بفاصل ثقة معلن: "تقدير أولي بناءً على 5 عمليات فقط، الثقة منخفضة") بدل "فارغ تمامًا"، يتحسن تدريجيًا مع تراكم البيانات.

### 6.3 مساعد استعلام بالمحادثة الطبيعية فوق شجرة التقارير الضخمة (90+ تقرير)
**البيانات المتاحة:** شجرة Reports الضخمة والمعقدة (صعبة التصفح لغير الخبير).
**الفكرة:** واجهة "اسأل بياناتك" (Natural Language to Report) — صاحب الصالون يكتب "شو أكتر خدمة ربحية الشهر الماضي؟" والنظام يحوّلها تلقائيًا لتشغيل التقرير الصحيح (Profitability of services) بالفلاتر المناسبة، بدل التنقل يدويًا بين عشرات التقارير.

---

# 7. الذكاء الاصطناعي بموديول Calls

### 7.1 تفريغ نصي تلقائي وتحليل للمكالمات (Speech-to-Text + NLP)
**البيانات المتاحة:** ميزة Telephony الموجودة (Asterisk/Binotel/Phonet integration)، حقل "Text" بجدول Calls.
**الفكرة:** لو فُعِّل Telephony فعليًا، تفريغ المكالمة صوتيًا لنص تلقائي، ثم استخراج نية الزبون تلقائيًا (طلب حجز، شكوى، استفسار عن سعر) لتصنيف الحقل "Status" تلقائيًا بدل الإدخال اليدوي.

### 7.2 اقتراح "Manager" الأنسب للزبون تلقائيًا
**البيانات المتاحة:** حقل Manager الحالي (يُدار يدويًا عبر "Change manager").
**الفكرة:** نموذج يحلل تاريخ التفاعل (مين تكلّم أكتر مع هاد الزبون، مين حقق أعلى معدل تحويل مكالمات لحجوزات فعلية) ويقترح تلقائيًا أفضل موظف ليكون Manager لزبون جديد.

---

# 8. الذكاء الاصطناعي بالتكامل مع الأجهزة (Optional Equipment)

### 8.1 تحليل صور "قبل/بعد" (Before/After) تلقائيًا
**البيانات المتاحة:** "Files" tab بملف الزبون (رفع صور بالفعل)، "Edit database of images for products".
**الفكرة:** استخدام Computer Vision لتصنيف الصور المرفوعة تلقائيًا (نوع الخدمة، منطقة الجسم/الشعر)، وتوليد صور "مقارنة قبل/بعد" تلقائية لاستخدامها بالتسويق (بموافقة الزبون)، أو تتبّع تطور حالة جلدية/شعرية عبر الزمن لخدمات العلاج المتكررة.

### 8.2 التحقق من الحضور بالتعرّف على الوجه كبديل/تكميل للبصمة
**البيانات المتاحة:** Fingerprints' reader الحالي (ZKTeco)، تنويه النظام الصريح بخصوص خطر تمرير بطاقة الزميل.
**الفكرة:** كاميرا بسيطة + نموذج Face recognition كطبقة تحقق إضافية أو بديلة للبصمة بالدول التي فيها قيود قانونية على تخزين بيانات البصمة (النظام نفسه ينوّه لهذا القيد القانوني صراحة بنص الميزة الحالية).

### 8.3 قراءة ذكية لسعر/نوع المنتج بالكاميرا بدل الباركود فقط
**البيانات المتاحة:** Barcode reader الحالي، "Edit database of images for products".
**الفكرة:** التعرّف البصري على المنتج (Image recognition) كطبقة إضافية لسرعة البيع بنقطة البيع، خاصة لمنتجات بدون باركود واضح (عبوات مفتوحة، عيّنات).

---

# 9. الذكاء الاصطناعي عبر النظام كله (Cross-cutting)

### 9.1 مساعد إعداد أولي ذكي (Smart Onboarding Assistant)
**البيانات المتاحة:** Setup Wizard الحالي (خطوات ثابتة يدوية).
**الفكرة:** بدل ملء كل خطوة يدويًا، صاحب الصالون يصف عمله بجملة واحدة ("صالون نسائي، 4 موظفين، شعر وأظافر بس")، ويقترح الذكاء الاصطناعي تلقائيًا: الخدمات المناسبة، جدول العمل الافتراضي، حتى Payment Plans نموذجية — يقلل وقت الإعداد الأولي بشكل كبير.

### 9.2 كشف تضارب الإعدادات تلقائيًا (Configuration Conflict Detector)
**البيانات المتاحة:** التعقيد الكبير برصدناه بشجرة Settings (RBAC دقيق، أنظمة بونص متعددة، Payment Plans مرنة).
**الفكرة:** نموذج يفحص إعدادات النظام بشكل دوري ويرفع تنبيهات منطقية: "لديك موظف بصلاحية Cancel receipts لكن بدون صلاحية View purchase prices — هل هذا مقصود؟" أو "بونص Sale bonus وBonus card مفعّلان معًا لنفس الخدمة، هل تقصد تراكمهما؟".

### 9.3 مساعد ذكي (Copilot) داخل الواجهة لكل الموظفين حسب دورهم
**البيانات المتاحة:** كل موديول موثّق بهاد التحليل.
**الفكرة:** طبقة محادثة عامة (LLM-powered) مدمجة بالواجهة، تجيب أسئلة الموظف حسب صلاحياته فعليًا ("شو راتبي المتوقع هالشهر؟" لموظف عادي يقرأ من "My salary" فقط، أو "كم الفرق بالصندوق اليوم؟" لإداري له صلاحية Cash per day) — واجهة واحدة تسهّل الوصول لبيانات موزّعة بعشرات الشاشات.

### 9.4 توقّع دخل الفرع الشهري (Revenue Forecasting) بدمج كل مصادر البيانات
**البيانات المتاحة:** Cash Flow، Scheduled visits، Client retention، Planning (الأهداف المُدخلة يدويًا حاليًا).
**الفكرة:** نموذج تنبؤ واحد يدمج بيانات الحجوزات المؤكدة + نمط الإلغاء التاريخي + معدل الاحتفاظ بالزبائن، ليعطي تقديرًا تلقائيًا لإيراد الشهر القادم يقارَن تلقائيًا بأهداف "Planning" بدل إدخال الأهداف يدويًا فقط دون تنبؤ فعلي مقابلها.

### 9.5 نظام إنذار مبكر موحّد (Unified Early Warning System)
**البيانات المتاحة:** كل تنبيهات النظام الحالية المتفرقة (Notify about products critical quantity، Gift card expiration، Client category change، Feedback rating منخفض...).
**الفكرة:** دمج كل هذه التنبيهات المتفرقة (المذكورة بأماكن متعددة بشجرة Settings→Reminder) بطبقة أولويات واحدة مبنية على الذكاء الاصطناعي، ترتّب التنبيهات حسب الأثر المالي الفعلي المتوقع، بدل عرضها كقائمة مسطحة بدون ترتيب أهمية.

---

# 10. خلاصة الأولويات (لو التنفيذ تدريجي)

بناءً على **أثر الأعمال مقابل جهد التنفيذ**، أعلى 5 أفكار أولوية للتنفيذ الفعلي:

1. **تنبيه استباقي بـ"بيانات تحتاج Recalculate"** (9.2 جزئيًا / 3.2) — أثر عالٍ، جهد منخفض جدًا (منطق قواعدي بسيط، ليس ML متقدمًا).
2. **تنبؤ Churn/عدم الحضور (No-show)** (1.1 و2.2) — بيانات جاهزة تمامًا بالنظام (History، Cancelled visits)، نموذج تصنيف بسيط نسبيًا.
3. **محرك ولاء موحّد ذكي** (4.3) — يحل أكبر نقطة ضعف معمارية موثّقة بالتحليل السابق.
4. **مساعد استعلام بالمحادثة الطبيعية فوق التقارير** (6.3) — يستفيد مباشرة من البنية الضخمة الموجودة أصلاً بـReports دون الحاجة لبناء بيانات جديدة.
5. **تنبؤ الطلب على المخزون** (5.1) — بيانات جاهزة (Purchase requests، Flow of products)، عائد مالي مباشر وسريع القياس.
-e 

---

*نهاية المرجع التقني الشامل — نظام Beauty Pro*
