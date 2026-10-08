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
            Transaction("tx-1", "دخل", 3500000.0, "شركة سوناطراك", "دفعة مشروع الأشغال العمومية", "2026-10-01", "تحويل بنكي", 12840000.0, "تم التحويل بنجاح", "محمد بنيني", true),
            Transaction("tx-2", "مصروف", 450000.0, "مؤسسة التجهيز", "شراء عتاد وصيانة", "2026-10-03", "شيك", 9340000.0, "صيانة دورية للرافعة", "عبد القادر محاسب", true),
            Transaction("tx-3", "دخل", 1800000.0, "مديرية الأشغال العمومية", "مستحقات شطر أول", "2026-10-05", "نقداً", 11140000.0, "استلام نقدي بالصندوق", "محمد بنيني", false)
        )
    )
    val transactions: StateFlow<List<Transaction>> = _transactions.asStateFlow()

    private val _inventory = MutableStateFlow(
        listOf(
            InventoryItem(
                id = "inv-1",
                name = "حديد تسليح Ø16",
                quantity = 100,
                buyPrice = 500.0,
                totalCost = 50000.0,
                sellPrice = 700.0,
                expectedProfit = 20000.0,
                realizedProfit = 12000.0,
                remainingQuantity = 60,
                supplier = "مؤسسة الحديد والصلب الجزائري",
                invoiceNumber = "INV-2026-001",
                purchaseDate = "2026-10-02",
                notes = "حديد عالي الجودة للمشروع الرئيسي",
                hasDocument = true
            ),
            InventoryItem(
                id = "inv-2",
                name = "أسمنت برتلاندي CEM II",
                quantity = 500,
                buyPrice = 950.0,
                totalCost = 475000.0,
                sellPrice = 1200.0,
                expectedProfit = 125000.0,
                realizedProfit = 75000.5,
                remainingQuantity = 210,
                supplier = "مصنع الأسمنت رويبة",
                invoiceNumber = "INV-2026-002",
                purchaseDate = "2026-10-04",
                notes = "أكياس أسمنت مقاوم للرطوبة",
                hasDocument = true
            ),
            InventoryItem(
                id = "inv-3",
                name = "أنابيب صرف صحي PVC 400مم",
                quantity = 50,
                buyPrice = 28000.0,
                totalCost = 1400000.0,
                sellPrice = 35000.0,
                expectedProfit = 350000.0,
                realizedProfit = 210000.0,
                remainingQuantity = 20,
                supplier = "شركة البلاستيك والصناعة",
                invoiceNumber = "INV-2026-003",
                purchaseDate = "2026-10-06",
                notes = "أنابيب لشبكة الصرف الصحي الكبرى",
                hasDocument = false
            )
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

    fun addTransaction(
        type: String,
        amount: Double,
        party: String,
        reason: String,
        paymentMethod: String,
        notes: String,
        hasDocument: Boolean
    ) {
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
            balanceAfter = newBal,
            notes = notes,
            recordedBy = _profile.value.name,
            hasDocument = hasDocument
        )
        _transactions.update { listOf(newTx) + it }
    }

    fun deleteTransaction(id: String) {
        _transactions.update { list -> list.filter { it.id != id } }
    }

    fun updateTransaction(
        id: String,
        type: String,
        amount: Double,
        party: String,
        reason: String,
        paymentMethod: String,
        notes: String,
        hasDocument: Boolean
    ) {
        _transactions.update { list ->
            list.map { tx ->
                if (tx.id == id) {
                    tx.copy(
                        type = type,
                        amount = amount,
                        party = party,
                        reason = reason,
                        paymentMethod = paymentMethod,
                        notes = notes,
                        hasDocument = hasDocument
                    )
                } else tx
            }
        }
    }

    fun addInventoryItem(
        name: String,
        quantity: Int,
        buyPrice: Double,
        sellPrice: Double,
        supplier: String,
        invoiceNumber: String,
        notes: String,
        hasDocument: Boolean
    ) {
        val totalCost = quantity * buyPrice
        val expectedSales = quantity * sellPrice
        val expectedProfit = expectedSales - totalCost
        val newItem = InventoryItem(
            id = "inv-${System.currentTimeMillis()}",
            name = name,
            quantity = quantity,
            buyPrice = buyPrice,
            totalCost = totalCost,
            sellPrice = sellPrice,
            expectedProfit = expectedProfit,
            realizedProfit = 0.0,
            remainingQuantity = quantity,
            supplier = supplier,
            invoiceNumber = invoiceNumber.ifBlank { "INV-${System.currentTimeMillis().toString().takeLast(4)}" },
            purchaseDate = "2026-10-08",
            notes = notes,
            hasDocument = hasDocument
        )
        _inventory.update { listOf(newItem) + it }
    }

    fun deleteInventoryItem(id: String) {
        _inventory.update { list -> list.filter { it.id != id } }
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
