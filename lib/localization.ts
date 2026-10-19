import type { Language } from "./api";
import { sections, type SectionId } from "../shared/sections";
import { apiErrorFrench } from "../shared/api-error-translations";
import { uiFrench } from "../shared/ui-translations-fr";
import { resolveThemeColor } from "./theme";

const fr: Record<string, string> = {
  ...apiErrorFrench,
  ...uiFrench,
  "الرئيسية": "Accueil", "التسيير المالي": "Gestion financière", "المشتريات": "Achats",
  "المخزون": "Stock", "الشيكات": "Chèques", "الكراء": "Locations",
  "المركبات والآليات": "Véhicules et engins", "تطبيق / عمليات رئيس الأشغال": "Opérations de chantier",
  "مصاريف الميدان": "Dépenses de terrain", "المستخدمون والصلاحيات": "Membres et autorisations",
  "سجل التدقيق": "Journal d’audit", "الإعدادات": "Paramètres", "الأعضاء": "Membres",
  "المالية": "Finance", "العودة إلى الرئيسية": "Retour à l’accueil", "تسجيل الخروج": "Déconnexion",
  "إعدادات الحساب والوصول": "Paramètres du compte", "إعدادات الحساب": "Paramètres du compte",
  "اللغة": "Langue", "العربية": "العربية", "Français": "Français", "المظهر": "Apparence",
  "فاتح": "Clair", "داكن": "Sombre", "حسب نظام الهاتف": "Selon le système",
  "الحساب": "Compte", "الاسم": "Nom", "طريقة الدخول": "Mode de connexion", "الصلاحية": "Rôle",
  "الأقسام المتاحة": "Sections accessibles", "إدارة المستخدمين والصلاحيات": "Gérer les membres et autorisations",
  "لتعديل صلاحيات أعضاء الفريق، استخدم إدارة المستخدمين والصلاحيات.": "Gérez les accès de l’équipe dans Membres et autorisations.",
  "جارٍ تحميل بيانات الحساب...": "Chargement du compte…", "تعذر تحميل إعدادات الحساب.": "Impossible de charger les paramètres.",
  "حفظ التفضيلات": "Enregistrer les préférences", "تم حفظ التفضيلات.": "Préférences enregistrées.",
  "تسجيل الدخول": "Connexion", "أدخل رقم الدخول المكوّن من ستة أرقام.": "Saisissez votre code d’accès à six chiffres.",
  "الرقم التسلسلي": "Code d’accès", "منصة موحّدة لإدارة الأشغال والمالية": "Plateforme de gestion des chantiers et des finances",
  "المركبات والآليات وقطع الغيار": "Véhicules et engins", "قطع الغيار": "Pièces détachées",
  "القائمة الرئيسية": "Menu principal", "إغلاق القائمة": "Fermer le menu", "فتح قائمة الأقسام": "Ouvrir le menu",
  "تحديث": "Actualiser", "رجوع": "Retour", "الرجوع إلى الرئيسية": "Retour à l’accueil",
  "اختر اللغة والمظهر اللذين يناسبانك. تحفظ التفضيلات على حسابك.": "Choisissez votre langue et votre thème. Vos préférences sont enregistrées sur votre compte.",
  "رقم تسلسلي من 6 أرقام": "Code d’accès à six chiffres", "تعذر حفظ التفضيلات.": "Impossible d’enregistrer les préférences.",
  "تتغير الواجهة واتجاه القراءة فوراً.": "L’interface et le sens de lecture changent immédiatement.",
  "يتبدل المظهر دون إعادة تحميل التطبيق.": "Le thème change sans recharger l’application.",
  "لم تُسجل أي عملية بعد.": "Aucune opération enregistrée.",
  "عمليات الميدان الواردة": "Opérations de terrain reçues", "تسجيل مصروف ميداني": "Enregistrer une dépense de terrain",
  "الآلة المرتبطة بالعملية *": "Engin associé à l’opération *", "ابحث عن الآلة بالاسم أو الرقم": "Rechercher un engin par nom ou code",
  "مازوت": "Gasoil", "قطع غيار": "Pièce détachée", "مشتريات": "Achats", "إصلاح آلية": "Réparation d’engin", "مصاريف أخرى": "Autres dépenses",
  "بانتظار المراجعة": "En attente de validation", "تمت المراجعة": "Validé", "الكل": "Tout",
  "لا توجد عمليات بهذه الحالة": "Aucune opération dans cet état", "لا توجد عمليات مسجلة بعد": "Aucune opération enregistrée",
  "الحساب غير مفعل أو لا يملك صلاحية الوصول إلى قسم المركبات والآليات.": "Le compte est inactif ou n’a pas accès aux véhicules et engins.",
  "السجلات التاريخية محفوظة للقراءة فقط. تُسجل القطع والإصلاحات الجديدة ضمن عمليات الميدان.": "Les anciens registres sont conservés en lecture seule. Saisissez les nouvelles pièces et réparations dans les opérations de terrain.",
  "سجلات قطع الغيار القديمة": "Anciens registres de pièces",
  "مراجعة مصاريف الميدان": "Validation des dépenses de terrain", "صفحة رئيس الأشغال": "Espace chef de chantier",
  "تصل العمليات هنا مباشرة من رئيس الأشغال لمراجعتها دون إعادة إدخالها.": "Les opérations du chef de chantier arrivent ici pour validation, sans nouvelle saisie.",
  "أرسل المصاريف والمازوت والوثائق مباشرة إلى الإدارة.": "Transmettez les dépenses, le gasoil et les justificatifs à l’administration.",
  "تظهر كل عملية مع بيانات مسجلها ووقت الإرسال ومرفقاتها.": "Chaque opération inclut son auteur, l’heure d’envoi et ses pièces jointes.",
  "إغلاق النموذج": "Fermer le formulaire", "تسجيل عملية جديدة": "Nouvelle opération", "ما نوع العملية؟": "Type d’opération ?",
  "تفاصيل المازوت": "Détails du gasoil", "تفاصيل العملية": "Détails de l’opération",
  "إضافة صور الفاتورة أو الوصل": "Ajouter facture ou justificatif", "تُحفظ العملية باسم حسابك وتظهر فورًا في سجل الإدارة.": "L’opération est enregistrée sous votre compte et visible immédiatement par l’administration.",
  "إرسال إلى الإدارة": "Envoyer à l’administration", "سجل العمليات الواردة": "Opérations reçues", "عملياتي الميدانية": "Mes opérations de terrain",
  "نوع العملية": "Type d’opération",
  "لا توجد عمليات بانتظار المراجعة": "Aucune opération à valider", "تاريخ التسجيل من": "Date de début", "تاريخ التسجيل إلى": "Date de fin",
  "مسح التاريخ": "Effacer les dates", "ملاحظات": "Notes", "مثال: تزويد آلية الورشة بالوقود": "Ex. ravitaillement de l’engin",
  "مثال: قطعة الغيار أو نوع الإصلاح": "Ex. pièce ou type de réparation", "أضف أي معلومة للإدارة": "Ajouter une note à l’administration",
  "المبلغ (دج) *": "Montant (DA) *", "الكمية باللتر *": "Quantité (litres) *", "الورشة / موقع العمل *": "Atelier / chantier *",
  "اسم الموقع أو الورشة": "Nom du chantier ou de l’atelier", "مثال: 50000": "Ex. 50 000", "مثال: 200": "Ex. 200",
  "مثال: TR-001": "Ex. TR-001", "سجلها:": "Saisie par :", "راجعها": "Validée par",
  "لا توجد فاتورة أو وصل مرفق.": "Aucune facture ni pièce jointe.", "لا توجد ملاحظات مسجلة.": "Aucune note enregistrée.",
  "الفواتير والوصولات": "Factures et justificatifs", "الآلة:": "Engin :",
  "العملية": "Opération", "إعادة للمراجعة": "Renvoyer en validation", "حفظ ربط الآلة": "Enregistrer l’association",
  "إغلاق اختيار الآلة": "Fermer le choix d’engin", "تعديل الآلة المرتبطة": "Modifier l’engin associé",
  "ربط العملية القديمة بآلة": "Associer l’opération à un engin", "الآلة المرتبطة بالعملية": "Engin associé à l’opération",
  "الكمية باللتر": "Quantité en litres", "سجل العمليات": "Journal des opérations",
  "استعادة رمز دخول المدير": "Récupérer le code administrateur", "إعداد دخول المدير الأول": "Configurer le premier administrateur",
  "أدخل رمز التهيئة لإصدار رمز دخول جديد من ستة أرقام. سيتوقف الرمز السابق عن العمل، ولن يظهر الرمز الجديد مرة أخرى.": "Saisissez le jeton de configuration pour générer un nouveau code à six chiffres. L’ancien code sera désactivé et le nouveau ne sera affiché qu’une fois.",
  "هذه الخطوة لمرة واحدة لإنشاء حساب المدير في قاعدة البيانات. أدخل رمز التهيئة ورقم الدخول المكوّن من ستة أرقام.": "Cette étape unique crée le compte administrateur. Saisissez le jeton de configuration et un code à six chiffres.",
  "تم إصدار رمز دخول جديد للمدير. احفظه الآن؛ لن يظهر مرة أخرى.": "Un nouveau code administrateur a été généré. Enregistrez-le maintenant, il ne sera plus affiché.",
  "تم إنشاء رقم المدير. احفظه الآن؛ لن يظهر مرة أخرى.": "Le code administrateur a été créé. Enregistrez-le maintenant, il ne sera plus affiché.",
  "العودة لتسجيل الدخول": "Retour à la connexion", "رمز التهيئة": "Jeton de configuration", "أدخل رمز التهيئة": "Saisir le jeton de configuration",
  "الرقم التسلسلي للمدير": "Code administrateur", "أدخل الرقم المكوّن من ستة أرقام": "Saisissez le code à six chiffres",
  "إصدار رمز جديد": "Générer un nouveau code", "إنشاء رقم المدير": "Créer le code administrateur",
  "الانتقال إلى إعداد المدير لأول مرة": "Accéder à la configuration initiale", "إعادة إصدار رمز دخول المدير": "Régénérer le code administrateur",
  "استعادة رمز الدخول": "Récupérer le code",
  "مدير النظام": "Administrateur", "الإدارة المالية": "Finance", "رئيس أشغال": "Chef de chantier",
  "مشرف": "Superviseur", "شريك": "Partenaire", "عضو": "Membre", "مقبول": "Approuvé", "مرفوض": "Rejeté",
  "موقع العمل *": "Chantier *",
  "الورشة / موقع العمل": "Atelier / chantier", "ابحث بالموقع أو النوع أو المسجل": "Rechercher par chantier, type ou auteur",
  "تصفية المصاريف من تاريخ": "Filtrer les dépenses depuis", "تصفية المصاريف إلى تاريخ": "Filtrer les dépenses jusqu’au",
  "الحد الأقصى هو خمسة صور أو وثائق للعملية الواحدة.": "Maximum cinq images ou documents par opération.",
  "اختر الآلة المرتبطة بالمازوت أو قطع الغيار أو الإصلاح.": "Sélectionnez l’engin associé au gasoil, à la pièce ou à la réparation.",
  "أدخل موقع العمل والمبلغ، وحدد كمية المازوت باللتر عند تسجيله.": "Saisissez le chantier, le montant et la quantité de gasoil en litres.",
  "تم إرسال العملية إلى المنصة الرئيسية للمراجعة.": "Opération transmise à l’administration pour validation.",
  "تم تسجيل مراجعة العملية.": "Validation enregistrée.", "أعيدت العملية إلى قائمة المراجعة.": "Opération renvoyée à la liste de validation.",
  "تعذر تحميل مصاريف الميدان.": "Impossible de charger les dépenses de terrain.",
  " · {{0}} لتر": " · {{0}} l",
  " · {{0}} للوحدة": " · {{0}} par unité",
  "{{0}} · الاستحقاق {{1}}": "{{0}} · échéance {{1}}",
  "{{0}} · متبقي {{1}}": "{{0}} · reste {{1}}",
  "{{0}} / {{1}} قطعة": "{{0}} / {{1}} pièces",
  "{{0}} إشعار غير مقروء": "{{0}} notification(s) non lue(s)",
  "{{0}} شيك": "{{0}} chèque(s)",
  "{{0}} شيك مستحق": "{{0}} chèque(s) arrivé(s) à échéance",
  "{{0}} في {{1}}": "{{0}} dans {{1}}",
  "{{0}} قطعة": "{{0}} pièce(s)",
  "{{0}} لتر · ": "{{0}} l · ",
  "{{0}} متبقي": "{{0}} restant",
  "{{0}} متبقي من {{1}} · {{2}}": "{{0}} restant sur {{1}} · {{2}}",
  "{{0}}. {{1}}. فتح السجل المرتبط": "{{0}}. {{1}}. Ouvrir l’enregistrement associé",
  "إزالة فاتورة {{0}}": "Supprimer la facture {{0}}",
  "الزبون{{0}}": "Client{{0}}",
  "السعر {{0}} (دج) *": "Tarif {{0}} (DA) *",
  "الكمية (المتاح {{0}}) *": "Quantité (disponible : {{0}}) *",
  "انتهى منذ {{0}} يوم": "Terminé depuis {{0}} jour(s)",
  "بحث في {{0}}": "Rechercher dans {{0}}",
  "تعديل الشيك {{0}}": "Modifier le chèque {{0}}",
  "تعديل العملية رقم {{0}}": "Modifier l’opération n° {{0}}",
  "تفعيل حساب {{0}}": "Activer le compte {{0}}",
  "تم تسجيل العملية ومزامنتها، لكن تعذر رفع بعض المرفقات. {{0}}": "Opération enregistrée et synchronisée, mais certaines pièces jointes n’ont pas pu être téléversées. {{0}}",
  "تم حفظ الشراء، لكن تعذر رفع المستندات. {{0}}": "Achat enregistré, mais les documents n’ont pas pu être téléversés. {{0}}",
  "تم حفظ بيانات الشيك، لكن تعذر رفع المرفق. {{0}}": "Chèque enregistré, mais la pièce jointe n’a pas pu être téléversée. {{0}}",
  "تم حفظ بيانات الكراء، لكن تعذر رفع المرفق. {{0}}": "Location enregistrée, mais la pièce jointe n’a pas pu être téléversée. {{0}}",
  "تنزيل {{0}}": "Télécharger {{0}}",
  "حذف {{0}}": "Supprimer {{0}}",
  "خلال {{0}} يوم": "dans {{0}} jour(s)",
  "رقم {{0}}": "N° {{0}}",
  "سيتم حذف الشيك رقم {{0}} وجميع مرفقاته. هل تريد المتابعة؟": "Le chèque n° {{0}} et toutes ses pièces jointes seront supprimés. Continuer ?",
  "سيتم حذف الملف «{{0}}» من السجل. لا يمكن التراجع عن هذا الإجراء.": "Le fichier «{{0}}» sera supprimé de l’enregistrement. Cette action est irréversible.",
  "سيتم حذف عقد كراء {{0}} وجميع مرفقاته. هل تريد المتابعة؟": "Le contrat de location {{0}} et toutes ses pièces jointes seront supprimés. Continuer ?",
  "سيُوقف دخول {{0}} ويُخفى حسابه من القائمة. ستبقى العمليات السابقة وسجلاتها محفوظة.": "L’accès de {{0}} sera désactivé et son compte masqué. Ses opérations et historiques seront conservés.",
  "شيك {{0}}": "Chèque {{0}}",
  "فتح {{0}}": "Ouvrir {{0}}",
  "لا توجد قطع غيار أو إصلاحات مسجلة{{0}}.": "Aucune pièce ni réparation enregistrée{{0}}.",
  "متأخر {{0}} يوم": "En retard de {{0}} jour(s)",
  "يستحق بعد {{0}} {{1}}": "Échéance dans {{0}} {{1}}",
  "ينتهي خلال {{0}} {{1}}": "Expire dans {{0}} {{1}}",
};

export function translate(text: string, language: Language) {
  return language === "fr" ? (fr[text] ?? text) : text;
}
let currentLanguage: Language = "ar";
export function setTranslationLanguage(language: Language) { currentLanguage = language; }
export function translateStatic(text: string) { return translate(text, currentLanguage); }
export function localizedTextAlign(value: "left" | "right") {
  if (currentLanguage === "ar") return value;
  return value === "right" ? "left" : "right";
}
export function localizedTextDirection() { return currentLanguage === "ar" ? "rtl" : "ltr"; }
export { resolveThemeColor };
export function translateTemplate(pattern: string, values: unknown[]) {
  let result = translate(pattern, currentLanguage);
  values.forEach((value, index) => { result = result.replaceAll(`{{${index}}}`, String(value)); });
  return result;
}
const sectionFrench: Record<SectionId, string> = {
  dashboard: "Accueil", finance: "Gestion financière", inventory: "Achats et stock",
  cheques: "Gestion des chèques", rentals: "Locations", machinery: "Véhicules et engins",
  field: "Dépenses de terrain", users: "Membres et autorisations", audit: "Journal d’audit",
};
export function sectionName(id: SectionId, language: Language) {
  return language === "fr" ? sectionFrench[id] : sections.find((s) => s.id === id)?.label ?? id;
}
const valuesFr: Record<string, string> = {
  مازوت: "Gasoil", "قطع غيار": "Pièce détachée", مشتريات: "Achats", "إصلاح آلية": "Réparation d’engin",
  "مصاريف أخرى": "Autres dépenses", pending: "En attente", reviewed: "Validé", paid: "Payé", unpaid: "Impayé",
  active: "Actif", inactive: "Inactif", "قيد الانتظار": "En attente", مدفوع: "Payé", "غير مدفوع": "Impayé",
};
export function displayValue(value: string, language: Language) {
  return language === "fr" ? (valuesFr[value] ?? value) : value;
}
