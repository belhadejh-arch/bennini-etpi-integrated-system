package com.example.benninietpi.ui

import androidx.lifecycle.ViewModel
import com.example.benninietpi.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

class MainViewModel : ViewModel() {

    private val _currentRoute = MutableStateFlow("dashboard")
    val currentRoute: StateFlow<String> = _currentRoute.asStateFlow()

    private val _profile = MutableStateFlow(
        AppUser("usr-1", "محمد بنيني", "belhadejh@gmail.com", "مدير عام", true)
    )
    val profile: StateFlow<AppUser> = _profile.asStateFlow()

    private val _transactions = MutableStateFlow(
        listOf(
            Transaction("tx-1", "دخل", 3500000.0, "شركة سوناطراك", "دفعة مشروع الأشغال العمومية", "2026-10-01", "تحويل بنكي", 12840000.0),
            Transaction("tx-2", "مصروف", 450000.0, "مؤسسة التجهيز", "شراء عتاد وصيانة", "2026-10-03", "صك", 9340000.0),
            Transaction("tx-3", "دخل", 1800000.0, "مديرية الأشغال العمومية", "مستحقات شطر أول", "2026-10-05", "صك", 11140000.0)
        )
    )
    val transactions: StateFlow<List<Transaction>> = _transactions.asStateFlow()

    private val _inventory = MutableStateFlow(
        listOf(
            InventoryItem("inv-1", "حديد تسليح Ø16", 120, 14500.0, 1740000.0, 85),
            InventoryItem("inv-2", "أسمنت برتلاندي CEM II", 500, 950.0, 475000.0, 210),
            InventoryItem("inv-3", "أنابيب صرف صحي PVC 400مم", 45, 28000.0, 1260000.0, 30)
        )
    )
    val inventory: StateFlow<List<InventoryItem>> = _inventory.asStateFlow()

    private val _cheques = MutableStateFlow(
        listOf(
            ChequeItem("chq-1", "CHQ-98214", 850000.0, "مجمع البناء الجزائري", "2026-10-20", "قيد الانتظار"),
            ChequeItem("chq-2", "CHQ-98215", 1200000.0, "شركة الآليات الكبرى", "2026-10-15", "قيد الانتظار"),
            ChequeItem("chq-3", "CHQ-98210", 430000.0, "مجموعة النقل السريع", "2026-09-28", "مدفوع")
        )
    )
    val cheques: StateFlow<List<ChequeItem>> = _cheques.asStateFlow()

    private val _rentals = MutableStateFlow(
        listOf(
            RentalItem("rnt-1", "رافعة برجية CAT-500", "شركة الأشغال الكبرى", 240000.0, "جاري"),
            RentalItem("rnt-2", "شاحنة قلاب رينو 6x4", "مؤسسة الطرقات", 0.0, "منتهي"),
            RentalItem("rnt-3", "حفار هيدروليكي JCB 220", "المقاولات العامة", 150000.0, "جاري")
        )
    )
    val rentals: StateFlow<List<RentalItem>> = _rentals.asStateFlow()

    private val _fieldExpenses = MutableStateFlow(
        listOf(
            FieldExpense("fld-1", "مازوت وقود", 65000.0, "ورشة رويبة المركزية", "عمار رئيس الورشة", "2026-10-06 10:30", "تعبئة شاحنة قلاب رقم 04", 450.0),
            FieldExpense("fld-2", "قطع غيار وصيانة", 34000.0, "ورشة البليدة", "خالد التقني", "2026-10-06 14:15", "تصليح هيدروليك الحفار")
        )
    )
    val fieldExpenses: StateFlow<List<FieldExpense>> = _fieldExpenses.asStateFlow()

    private val _machinery = MutableStateFlow(
        listOf(
            MachineryItem("mch-1", "MCH-01", "حفار هيدروليكي JCB 220", "معدات ثقيلة", "يعمل", 78, 1420),
            MachineryItem("mch-2", "MCH-02", "رافعة برجية كاتربيلر", "رافعات", "صيانة", 45, 2300),
            MachineryItem("mch-3", "MCH-03", "شاحنة قلاب مرسيدس", "نقل", "يعمل", 90, 3100)
        )
    )
    val machinery: StateFlow<List<MachineryItem>> = _machinery.asStateFlow()

    private val _users = MutableStateFlow(
        listOf(
            AppUser("usr-1", "محمد بنيني", "belhadejh@gmail.com", "مدير عام", true),
            AppUser("usr-2", "عبد القادر محاسب", "finance@bennini.dz", "محاسب", true),
            AppUser("usr-3", "عمار رئيس الورشة", "foreman@bennini.dz", "رئيس أشغال", true)
        )
    )
    val users: StateFlow<List<AppUser>> = _users.asStateFlow()

    private val _auditLogs = MutableStateFlow(
        listOf(
            AuditLog("log-1", "تسجيل دخل جديد", "محمد بنيني", "2026-10-05 11:00", "إضافة دفعة من مديرية الأشغال العمومية 1,800,000 دج"),
            AuditLog("log-2", "تحديث مخزون", "عبد القادر محاسب", "2026-10-04 09:30", "إدخال شحنة أسمنت برتلاندي"),
            AuditLog("log-3", "تسجيل مصروف ميداني", "عمار رئيس الورشة", "2026-10-03 16:45", "شراء مازوت وقود لورشة رويبة")
        )
    )
    val auditLogs: StateFlow<List<AuditLog>> = _auditLogs.asStateFlow()

    fun navigateTo(route: String) {
        _currentRoute.value = route
    }

    fun addTransaction(type: String, amount: Double, party: String, reason: String, paymentMethod: String) {
        val currentBal = _transactions.value.firstOrNull()?.balanceAfter ?: 10000000.0
        val newBal = if (type == "دخل") currentBal + amount else currentBal - amount
        val newTx = Transaction(
            id = "tx-${System.currentTimeMillis()}",
            type = type,
            amount = amount,
            party = party,
            reason = reason,
            date = "2026-10-08",
            paymentMethod = paymentMethod,
            balanceAfter = newBal
        )
        _transactions.update { listOf(newTx) + it }
    }

    fun addFieldExpense(category: String, amount: Double, siteName: String, details: String, fuelLiters: Double?) {
        val newExp = FieldExpense(
            id = "fld-${System.currentTimeMillis()}",
            category = category,
            amount = amount,
            siteName = siteName,
            createdByName = _profile.value.name,
            createdAt = "2026-10-08 15:00",
            details = details,
            fuelLiters = fuelLiters
        )
        _fieldExpenses.update { listOf(newExp) + it }
    }

    fun addInventoryItem(name: String, quantity: Int, buyPrice: Double) {
        val total = quantity * buyPrice
        val newItem = InventoryItem(
            id = "inv-${System.currentTimeMillis()}",
            name = name,
            quantity = quantity,
            buyPrice = buyPrice,
            totalCost = total,
            remainingQuantity = quantity
        )
        _inventory.update { listOf(newItem) + it }
    }

    fun addCheque(chequeNumber: String, amount: Double, beneficiary: String, dueDate: String) {
        val newChq = ChequeItem(
            id = "chq-${System.currentTimeMillis()}",
            chequeNumber = chequeNumber,
            amount = amount,
            beneficiary = beneficiary,
            dueDate = dueDate,
            status = "قيد الانتظار"
        )
        _cheques.update { listOf(newChq) + it }
    }
}
