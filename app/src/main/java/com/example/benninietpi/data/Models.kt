package com.example.benninietpi.data

data class Transaction(
    val id: String,
    val type: String, // "دخل" or "مصروف"
    val amount: Double,
    val party: String, // مصدر المبلغ أو الجهة المستفيدة
    val reason: String, // سبب العملية
    val date: String, // التاريخ
    val paymentMethod: String, // "نقداً", "شيك", "تحويل بنكي"
    val balanceAfter: Double, // المبلغ المتبقي في الصندوق
    val notes: String = "", // ملاحظات
    val recordedBy: String = "محمد بنيني", // المستخدم الذي سجل العملية
    val hasDocument: Boolean = false // إرفاق فاتورة أو وصل أو وثيقة
)

data class InventoryItem(
    val id: String,
    val name: String, // اسم السلعة
    val quantity: Int, // الكمية الإجمالية المشراة
    val buyPrice: Double, // سعر الشراء للوحدة
    val totalCost: Double, // إجمالي التكلفة = الكمية × سعر الشراء
    val sellPrice: Double, // سعر البيع للوحدة
    val expectedProfit: Double, // قيمة الربح المتوقعة = (الكمية × سعر البيع) - إجمالي التكلفة
    val realizedProfit: Double, // الربح المحقق
    val remainingQuantity: Int, // الكمية المتبقية في المخزون
    val supplier: String, // المورد
    val invoiceNumber: String, // رقم الفاتورة
    val purchaseDate: String, // تاريخ الشراء
    val notes: String = "", // ملاحظات
    val hasDocument: Boolean = false // الفاتورة أو الوثيقة المرفقة
)

data class ChequeItem(
    val id: String,
    val chequeNumber: String, // رقم الشيك
    val invoiceNumber: String, // رقم الفاتورة المرتبطة
    val amount: Double, // المبلغ
    val beneficiary: String, // المستفيد
    val bank: String, // البنك
    val issueDate: String, // تاريخ الإصدار
    val dueDate: String, // تاريخ الاستحقاق
    val status: String, // "قيد الانتظار", "مدفوع", "ملغى"
    val notes: String = "", // ملاحظات
    val hasImage: Boolean = true, // صورة الشيك
    val hasDocument: Boolean = true // الفاتورة أو الوثيقة المرتبطة
)

data class RentalItem(
    val id: String,
    val equipment: String, // الشيء المؤجر
    val clientOrOwner: String, // اسم المستأجر / المؤجر
    val startDate: String, // تاريخ بداية الكراء
    val endDate: String, // تاريخ نهاية الكراء
    val duration: String, // مدة الكراء
    val rate: String, // السعر اليومي أو الشهري
    val totalAmount: Double, // المبلغ الإجمالي
    val paidAmount: Double, // المبلغ المدفوع
    val remainingAmount: Double, // المبلغ المتبقي
    val status: String, // "جاري", "منتهي"
    val notes: String = "", // ملاحظات
    val hasDocument: Boolean = true // العقد والوثائق المرفقة
)

data class FieldExpense(
    val id: String,
    val category: String,
    val amount: Double,
    val siteName: String,
    val createdByName: String,
    val createdAt: String,
    val details: String,
    val fuelLiters: Double? = null
)

data class MachineryItem(
    val id: String,
    val code: String,
    val name: String,
    val type: String,
    val status: String, // "يعمل", "صيانة", "متوقف"
    val fuelLevelPercent: Int,
    val hoursWorked: Int
)

data class AppUser(
    val id: String,
    val name: String,
    val email: String,
    val role: String, // "مدير عام", "محاسب", "رئيس أشغال"
    val active: Boolean
)

data class AuditLog(
    val id: String,
    val action: String,
    val performedBy: String,
    val timestamp: String,
    val details: String
)
