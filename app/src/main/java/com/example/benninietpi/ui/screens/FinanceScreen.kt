package com.example.benninietpi.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.benninietpi.data.Transaction
import com.example.benninietpi.ui.MainViewModel
import com.example.benninietpi.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FinanceScreen(viewModel: MainViewModel) {
    val transactions by viewModel.transactions.collectAsState()

    // Filters and Search state
    var searchQuery by remember { mutableStateOf("") }
    var filterType by remember { mutableStateOf("الكل") } // "الكل", "دخل", "مصروف"
    var filterPayment by remember { mutableStateOf("الكل") } // "الكل", "نقداً", "شيك", "تحويل بنكي"

    // Dialog state
    var showAddDialog by remember { mutableStateOf(false) }
    var editingTransaction by remember { mutableStateOf<Transaction?>(null) }
    var viewingTransaction by remember { mutableStateOf<Transaction?>(null) }
    var showDocDialog by remember { mutableStateOf<Transaction?>(null) }

    // Form state
    var type by remember { mutableStateOf("دخل") }
    var amountStr by remember { mutableStateOf("") }
    var party by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("") }
    var paymentMethod by remember { mutableStateOf("تحويل بنكي") }
    var notes by remember { mutableStateOf("") }
    var hasDocument by remember { mutableStateOf(false) }

    val currentBalance = transactions.firstOrNull()?.balanceAfter ?: 12840000.0
    val totalIncome = transactions.filter { it.type == "دخل" }.sumOf { it.amount }
    val totalExpense = transactions.filter { it.type == "مصروف" || it.type == "خرج" }.sumOf { it.amount }

    // Filtered transactions
    val filteredTransactions = transactions.filter { tx ->
        val matchesSearch = tx.party.contains(searchQuery, ignoreCase = true) ||
                tx.reason.contains(searchQuery, ignoreCase = true) ||
                tx.recordedBy.contains(searchQuery, ignoreCase = true)
        val matchesType = filterType == "الكل" || tx.type == filterType
        val matchesPayment = filterPayment == "الكل" || tx.paymentMethod.contains(filterPayment, ignoreCase = true)
        matchesSearch && matchesType && matchesPayment
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("التسيير المالي وصندوق الشركة 💰", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DeepBlue, titleContentColor = Color.White)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    editingTransaction = null
                    type = "دخل"
                    amountStr = ""
                    party = ""
                    reason = ""
                    paymentMethod = "تحويل بنكي"
                    notes = ""
                    hasDocument = false
                    showAddDialog = true
                },
                containerColor = BrandYellow,
                contentColor = DeepBlue
            ) {
                Icon(Icons.Default.Add, contentDescription = "إضافة عملية مالية")
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(BackgroundLight)
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Summary Card
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = PrimaryBlue),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text("الرصيد المتبقي بالصندوق الحقيقي", color = Color(0xFFCBD5E1), fontSize = 13.sp)
                        Text(
                            text = "${String.format("%,.0f", currentBalance)} دج",
                            color = Color.White,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Black,
                            modifier = Modifier.padding(vertical = 6.dp)
                        )
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("إجمالي المداخيل: +${String.format("%,.0f", totalIncome)} دج", color = Color(0xFF10B981), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Text("إجمالي المصاريف: -${String.format("%,.0f", totalExpense)} دج", color = Color(0xFFF5B41E), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Search and Filters Bar
            item {
                Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            label = { Text("بحث بالجهة أو السبب أو المستخدم...") },
                            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            // Type filter
                            DropdownMenuFilter(
                                label = "النوع: $filterType",
                                options = listOf("الكل", "دخل", "مصروف"),
                                onSelected = { filterType = it },
                                modifier = Modifier.weight(1f)
                            )
                            // Payment method filter
                            DropdownMenuFilter(
                                label = "الدفع: $filterPayment",
                                options = listOf("الكل", "نقداً", "شيك", "تحويل بنكي"),
                                onSelected = { filterPayment = it },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("سجل العمليات المالية (${filteredTransactions.size})", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = DeepBlue)
                    if (searchQuery.isNotBlank() || filterType != "الكل" || filterPayment != "الكل") {
                        TextButton(onClick = {
                            searchQuery = ""
                            filterType = "الكل"
                            filterPayment = "الكل"
                        }) {
                            Text("إعادة ضبط التصفية", fontSize = 12.sp)
                        }
                    }
                }
            }

            items(filteredTransactions) { tx ->
                Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(if (tx.type == "دخل") Color(0xFFECFDF5) else Color(0xFFFFF1F2)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = if (tx.type == "دخل") "+" else "-",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 16.sp,
                                        color = if (tx.type == "دخل") Color(0xFF059669) else Color(0xFFEF4444)
                                    )
                                }
                                Column {
                                    Text(tx.party, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = DeepBlue)
                                    Text("${tx.reason} • ${tx.paymentMethod}", fontSize = 12.sp, color = TextSecondary)
                                }
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = "${String.format("%,.0f", tx.amount)} دج",
                                    fontWeight = FontWeight.Black,
                                    fontSize = 14.sp,
                                    color = if (tx.type == "دخل") Color(0xFF059669) else Color(0xFFEF4444)
                                )
                                Text(tx.date, fontSize = 10.sp, color = TextSecondary)
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))
                        HorizontalDivider(color = Color(0xFFF1F5F9))
                        Spacer(modifier = Modifier.height(10.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("المسجل: ${tx.recordedBy}", fontSize = 11.sp, color = TextSecondary)
                                if (tx.notes.isNotBlank()) {
                                    Text("ملاحظات: ${tx.notes}", fontSize = 11.sp, color = DeepBlue)
                                }
                            }

                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                if (tx.hasDocument) {
                                    IconButton(
                                        onClick = { showDocDialog = tx },
                                        modifier = Modifier.size(32.dp)
                                    ) {
                                        Icon(Icons.Default.AttachFile, contentDescription = "عرض الوثيقة", tint = PrimaryBlue, modifier = Modifier.size(18.dp))
                                    }
                                }
                                IconButton(
                                    onClick = { viewingTransaction = tx },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(Icons.Default.Visibility, contentDescription = "عرض", tint = PrimaryBlue, modifier = Modifier.size(18.dp))
                                }
                                IconButton(
                                    onClick = {
                                        editingTransaction = tx
                                        type = tx.type
                                        amountStr = tx.amount.toString()
                                        party = tx.party
                                        reason = tx.reason
                                        paymentMethod = tx.paymentMethod
                                        notes = tx.notes
                                        hasDocument = tx.hasDocument
                                        showAddDialog = true
                                    },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(Icons.Default.Edit, contentDescription = "تعديل", tint = Color(0xFFD97706), modifier = Modifier.size(18.dp))
                                }
                                IconButton(
                                    onClick = { viewModel.deleteTransaction(tx.id) },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(Icons.Default.Delete, contentDescription = "حذف", tint = Color(0xFFEF4444), modifier = Modifier.size(18.dp))
                                }
                            }
                        }
                    }
                }
            }
        }

        // Add / Edit Dialog
        if (showAddDialog) {
            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text(if (editingTransaction == null) "تسجيل عملية مالية جديدة" else "تعديل العملية المالية", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = { type = "دخل" },
                                colors = ButtonDefaults.buttonColors(containerColor = if (type == "دخل") Color(0xFF059669) else Color.LightGray)
                            ) { Text("دخل") }
                            Button(
                                onClick = { type = "مصروف" },
                                colors = ButtonDefaults.buttonColors(containerColor = if (type == "مصروف") Color(0xFFEF4444) else Color.LightGray)
                            ) { Text("مصروف") }
                        }
                        OutlinedTextField(
                            value = amountStr,
                            onValueChange = { amountStr = it },
                            label = { Text("المبلغ (دج)") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = party,
                            onValueChange = { party = it },
                            label = { Text("مصدر المبلغ أو الجهة المستفيدة") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = reason,
                            onValueChange = { reason = it },
                            label = { Text("سبب العملية / البيان") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )

                        // Payment method dropdown selection
                        Text("طريقة الدفع:", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = DeepBlue)
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("نقداً", "شيك", "تحويل بنكي").forEach { method ->
                                FilterChip(
                                    selected = paymentMethod == method,
                                    onClick = { paymentMethod = method },
                                    label = { Text(method, fontSize = 11.sp) }
                                )
                            }
                        }

                        OutlinedTextField(
                            value = notes,
                            onValueChange = { notes = it },
                            label = { Text("ملاحظات إضافية") },
                            modifier = Modifier.fillMaxWidth()
                        )

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(
                                checked = hasDocument,
                                onCheckedChange = { hasDocument = it }
                            )
                            Text("إرفاق فاتورة / وصل / وثيقة رسمية", fontSize = 13.sp)
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val amt = amountStr.toDoubleOrNull() ?: 0.0
                            if (amt > 0 && party.isNotBlank()) {
                                if (editingTransaction == null) {
                                    viewModel.addTransaction(type, amt, party, reason.ifBlank { "عملية مالية" }, paymentMethod, notes, hasDocument)
                                } else {
                                    viewModel.updateTransaction(editingTransaction!!.id, type, amt, party, reason, paymentMethod, notes, hasDocument)
                                }
                                showAddDialog = false
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                    ) {
                        Text("حفظ العملية")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showAddDialog = false }) { Text("إلغاء") }
                }
            )
        }

        // View Transaction Dialog
        viewingTransaction?.let { tx ->
            AlertDialog(
                onDismissRequest = { viewingTransaction = null },
                title = { Text("تفاصيل العملية المالية", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("النوع: ${tx.type}", fontWeight = FontWeight.Bold, color = if (tx.type == "دخل") Color(0xFF059669) else Color(0xFFEF4444))
                        Text("المبلغ: ${String.format("%,.0f", tx.amount)} دج", fontWeight = FontWeight.Bold)
                        Text("الجهة (المصدر / المستفيد): ${tx.party}")
                        Text("السبب: ${tx.reason}")
                        Text("التاريخ: ${tx.date}")
                        Text("طريقة الدفع: ${tx.paymentMethod}")
                        Text("المسجل بواسطة: ${tx.recordedBy}")
                        if (tx.notes.isNotBlank()) {
                            Text("ملاحظات: ${tx.notes}")
                        }
                        val docStatus = if (tx.hasDocument) "يوجد فاتورة / وصل مرفق ✓" else "لا يوجد"
                        Text("الوثائق المرفقة: $docStatus")
                    }
                },
                confirmButton = {
                    Button(onClick = { viewingTransaction = null }) { Text("إغلاق") }
                }
            )
        }

        // Document Attachment Dialog
        showDocDialog?.let { tx ->
            AlertDialog(
                onDismissRequest = { showDocDialog = null },
                title = { Text("عرض المستند / الفاتورة المرفقة", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("العملية: ${tx.party} - ${String.format("%,.0f", tx.amount)} دج")
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(180.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFFE2E8F0)),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(Icons.Default.Description, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(48.dp))
                                Spacer(modifier = Modifier.height(8.dp))
                                Text("فاتورة / وصل رسمي رقم ${tx.id}", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = DeepBlue)
                                Text("تم التحقق والمصادقة في النظام", fontSize = 11.sp, color = Color(0xFF059669))
                            }
                        }
                    }
                },
                confirmButton = {
                    Button(onClick = { showDocDialog = null }) { Text("إغلاق") }
                }
            )
        }
    }
}

@Composable
fun DropdownMenuFilter(
    label: String,
    options: List<String>,
    onSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }

    Box(modifier = modifier) {
        OutlinedButton(
            onClick = { expanded = true },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(label, fontSize = 12.sp)
            Spacer(modifier = Modifier.width(4.dp))
            Icon(Icons.Default.ArrowDropDown, contentDescription = null, modifier = Modifier.size(16.dp))
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option) },
                    onClick = {
                        onSelected(option)
                        expanded = false
                    }
                )
            }
        }
    }
}
