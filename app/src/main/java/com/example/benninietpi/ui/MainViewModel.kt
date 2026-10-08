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
            )
        )
    )
    val inventory: StateFlow<List<InventoryItem>> = _inventory.asStateFlow()

    private val _cheques = MutableStateFlow(
        listOf(
            ChequeItem(
                id = "chq-1",
                chequeNumber = "CHQ-98214",
                invoiceNumber = "INV-2026-101",
                amount = 850000.0,
                beneficiary = "مجمع البناء الجزائري",
                bank = "بنك الجزائر الخارجي (BAE)",
                issueDate = "2026-09-20",
                dueDate = "2026-10-12", // approaching due date
                status = "قيد الانتظار",
                notes = "شيك ضمان المشروع الأول",
                hasImage = true,
                hasDocument = true
            ),
            ChequeItem(
                id = "chq-2",
                chequeNumber = "CHQ-98215",
                invoiceNumber = "INV-2026-102",
                amount = 1200000.0,
                beneficiary = "شركة الآليات الكبرى",
                bank = "الوطني الجزائري (BNA)",
                issueDate = "2026-09-25",
                dueDate = "2026-10-18",
                status = "قيد الانتظار",
                notes = "دفعة كراء الحفار",
                hasImage = true,
                hasDocument = true
            ),
            ChequeItem(
                id = "chq-3",
                chequeNumber = "CHQ-98210",
                invoiceNumber = "INV-2026-099",
                amount = 430000.0,
                beneficiary = "مجموعة النقل السريع",
                bank = "القرض الشعبي الجزائري (CPA)",
                issueDate = "2026-09-01",
                dueDate = "2026-09-28",
                status = "مدفوع",
                notes = "تم الصرف بنجاح",
                hasImage = true,
                hasDocument = true
            )
        )
    )
    val cheques: StateFlow<List<ChequeItem>> = _cheques.asStateFlow()

    private val _rentals = MutableStateFlow(
        listOf(
            RentalItem(
                id = "rnt-1",
                equipment = "رافعة برجية CAT-500",
                clientOrOwner = "شركة الأشغال الكبرى",
                startDate = "2026-08-01",
                endDate = "2026-11-01",
                duration = "3 أشهر",
                rate = "80,000 دج / شهرياً",
                totalAmount = 240000.0,
                paidAmount = 160000.0,
                remainingAmount = 80000.0,
                status = "جاري",
                notes = "موقع ورشة رويبة الكبرى",
                hasDocument = true
            ),
            RentalItem(
                id = "rnt-2",
                equipment = "شاحنة قلاب رينو 6x4",
                clientOrOwner = "مؤسسة الطرقات الوطنية",
                startDate = "2026-07-10",
                endDate = "2026-09-10",
                duration = "شهرين",
                rate = "35,000 دج / شهرياً",
                totalAmount = 70000.0,
                paidAmount = 70000.0,
                remainingAmount = 0.0,
                status = "منتهي",
                notes = "تم تسليم الشاحنة بحالة ممتازة",
                hasDocument = true
            ),
            RentalItem(
                id = "rnt-3",
                equipment = "حفار هيدروليكي JCB 220",
                clientOrOwner = "المقاولات العامة للصناعة",
                startDate = "2026-09-01",
                endDate = "2026-12-01",
                duration = "3 أشهر",
                rate = "150,000 دج / شهرياً",
                totalAmount = 450000.0,
                paidAmount = 300000.0,
                remainingAmount = 150000.0,
                status = "جاري",
                notes = "أعمال الحفر والتهيئة",
                hasDocument = true
            )
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

    fun addCheque(
        chequeNumber: String,
        invoiceNumber: String,
        amount: Double,
        beneficiary: String,
        bank: String,
        issueDate: String,
        dueDate: String,
        status: String,
        notes: String
    ) {
        val newChq = ChequeItem(
            id = "chq-${System.currentTimeMillis()}",
            chequeNumber = chequeNumber,
            invoiceNumber = invoiceNumber.ifBlank { "INV-000" },
            amount = amount,
            beneficiary = beneficiary,
            bank = bank.ifBlank { "بنك الجزائر الخارجي" },
            issueDate = issueDate.ifBlank { "2026-10-01" },
            dueDate = dueDate.ifBlank { "2026-10-25" },
            status = status,
            notes = notes,
            hasImage = true,
            hasDocument = true
        )
        _cheques.update { listOf(newChq) + it }
    }

    fun deleteCheque(id: String) {
        _cheques.update { list -> list.filter { it.id != id } }
    }

    fun updateChequeStatus(id: String, newStatus: String) {
        _cheques.update { list ->
            list.map { chq -> if (chq.id == id) chq.copy(status = newStatus) else chq }
        }
    }

    fun addRental(
        equipment: String,
        clientOrOwner: String,
        startDate: String,
        endDate: String,
        duration: String,
        rate: String,
        totalAmount: Double,
        paidAmount: Double,
        status: String,
        notes: String
    ) {
        val remaining = totalAmount - paidAmount
        val newRnt = RentalItem(
            id = "rnt-${System.currentTimeMillis()}",
            equipment = equipment,
            clientOrOwner = clientOrOwner,
            startDate = startDate.ifBlank { "2026-10-01" },
            endDate = endDate.ifBlank { "2026-12-01" },
            duration = duration.ifBlank { "شهر واحد" },
            rate = rate.ifBlank { "50,000 دج" },
            totalAmount = totalAmount,
            paidAmount = paidAmount,
            remainingAmount = remaining,
            status = status,
            notes = notes,
            hasDocument = true
        )
        _rentals.update { listOf(newRnt) + it }
    }

    fun deleteRental(id: String) {
        _rentals.update { list -> list.filter { it.id != id } }
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
}
