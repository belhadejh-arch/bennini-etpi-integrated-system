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
    val name: String,
    val quantity: Int,
    val buyPrice: Double,
    val totalCost: Double,
    val remainingQuantity: Int
)

data class ChequeItem(
    val id: String,
    val chequeNumber: String,
    val amount: Double,
    val beneficiary: String,
    val dueDate: String,
    val status: String // "قيد الانتظار", "مدفوع", "ملغي"
)

data class RentalItem(
    val id: String,
    val equipment: String,
    val clientOrOwner: String,
    val remainingAmount: Double,
    val status: String // "جاري", "منتهي"
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
