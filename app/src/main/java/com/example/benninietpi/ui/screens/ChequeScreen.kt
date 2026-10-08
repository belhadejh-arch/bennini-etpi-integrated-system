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
import com.example.benninietpi.data.ChequeItem
import com.example.benninietpi.ui.MainViewModel
import com.example.benninietpi.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChequeScreen(viewModel: MainViewModel) {
    val cheques by viewModel.cheques.collectAsState()

    // Search & Filter
    var searchQuery by remember { mutableStateOf("") }
    var filterStatus by remember { mutableStateOf("الكل") } // "الكل", "قيد الانتظار", "مدفوع", "ملغى"

    // Dialogs
    var showAddDialog by remember { mutableStateOf(false) }
    var viewingCheque by remember { mutableStateOf<ChequeItem?>(null) }
    var showImageDialog by remember { mutableStateOf<ChequeItem?>(null) }

    // Form state
    var chequeNumber by remember { mutableStateOf("") }
    var invoiceNumber by remember { mutableStateOf("") }
    var amountStr by remember { mutableStateOf("") }
    var beneficiary by remember { mutableStateOf("") }
    var bank by remember { mutableStateOf("بنك الجزائر الخارجي") }
    var issueDate by remember { mutableStateOf("2026-10-01") }
    var dueDate by remember { mutableStateOf("2026-10-25") }
    var status by remember { mutableStateOf("قيد الانتظار") }
    var notes by remember { mutableStateOf("") }

    val pendingTotal = cheques.filter { it.status == "قيد الانتظار" }.sumOf { it.amount }
    val paidTotal = cheques.filter { it.status == "مدفوع" }.sumOf { it.amount }
    val dueSoonCount = cheques.count { it.status == "قيد الانتظار" }

    val filteredCheques = cheques.filter { chq ->
        val matchesSearch = chq.chequeNumber.contains(searchQuery, ignoreCase = true) ||
                chq.invoiceNumber.contains(searchQuery, ignoreCase = true) ||
                chq.beneficiary.contains(searchQuery, ignoreCase = true) ||
                chq.bank.contains(searchQuery, ignoreCase = true)
        val matchesStatus = filterStatus == "الكل" || chq.status == filterStatus
        matchesSearch && matchesStatus
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("إدارة وتنظيم الشيكات 🧾", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DeepBlue, titleContentColor = Color.White)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    chequeNumber = "CHQ-${(98000..99999).random()}"
                    invoiceNumber = ""
                    amountStr = ""
                    beneficiary = ""
                    bank = "بنك الجزائر الخارجي"
                    notes = ""
                    showAddDialog = true
                },
                containerColor = BrandYellow,
                contentColor = DeepBlue
            ) {
                Icon(Icons.Default.Add, contentDescription = "إضافة شيك جديد")
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
            // Alert Banner for Approaching Cheques
            if (dueSoonCount > 0) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF3C7)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFD97706))
                            Column {
                                Text("تنبيه استحقاق الشيكات", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFFB45309))
                                Text("يوجد $dueSoonCount شيكات قيد الانتظار ويجب متابعة تواريخ استحقاقها في الصندوق.", fontSize = 11.sp, color = Color(0xFF78350F))
                            }
                        }
                    }
                }
            }

            // Summary Cards
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = PrimaryBlue),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text("إجمالي الشيكات قيد الانتظار", color = Color(0xFFCBD5E1), fontSize = 13.sp)
                        Text(
                            text = "${String.format("%,.0f", pendingTotal)} دج",
                            color = Color.White,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Black,
                            modifier = Modifier.padding(vertical = 6.dp)
                        )
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("الشيكات المدفوعة: ${String.format("%,.0f", paidTotal)} دج", color = Color(0xFF10B981), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Text("العدد المعلق: $dueSoonCount شيك", color = Color(0xFFF5B41E), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Search and Status Filter
            item {
                Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            label = { Text("بحث برقم الشيك، الفاتورة، المستفيد أو البنك...") },
                            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )

                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("الكل", "قيد الانتظار", "مدفوع", "ملغى").forEach { st ->
                                FilterChip(
                                    selected = filterStatus == st,
                                    onClick = { filterStatus = st },
                                    label = { Text(st, fontSize = 11.sp) }
                                )
                            }
                        }
                    }
                }
            }

            item {
                Text("قائمة الشيكات (${filteredCheques.size})", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = DeepBlue)
            }

            items(filteredCheques) { chq ->
                Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("شيك رقم: ${chq.chequeNumber}", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = DeepBlue)
                                Text("المستفيد: ${chq.beneficiary} • البنك: ${chq.bank}", fontSize = 12.sp, color = TextSecondary)
                            }
                            Badge(
                                containerColor = when (chq.status) {
                                    "قيد الانتظار" -> Color(0xFFFEF3C7)
                                    "مدفوع" -> Color(0xFFECFDF5)
                                    else -> Color(0xFFFFF1F2)
                                }
                            ) {
                                Text(
                                    text = chq.status,
                                    color = when (chq.status) {
                                        "قيد الانتظار" -> Color(0xFFB45309)
                                        "مدفوع" -> Color(0xFF059669)
                                        else -> Color(0xFFEF4444)
                                    },
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))
                        HorizontalDivider(color = Color(0xFFF1F5F9))
                        Spacer(modifier = Modifier.height(10.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("فاتورة مرتبطة: ${chq.invoiceNumber}", fontSize = 11.sp, color = TextSecondary)
                                Text("الاستحقاق: ${chq.dueDate}", fontSize = 11.sp, color = Color(0xFFD97706), fontWeight = FontWeight.Bold)
                            }
                            Text("${String.format("%,.0f", chq.amount)} دج", fontWeight = FontWeight.Black, fontSize = 15.sp, color = DeepBlue)
                        }

                        Spacer(modifier = Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                if (chq.status == "قيد الانتظار") {
                                    OutlinedButton(
                                        onClick = { viewModel.updateChequeStatus(chq.id, "مدفوع") },
                                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                                    ) {
                                        Text("تسجيل مدفوع", fontSize = 10.sp)
                                    }
                                }
                            }

                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                IconButton(
                                    onClick = { showImageDialog = chq },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(Icons.Default.Image, contentDescription = "صورة الشيك", tint = PrimaryBlue, modifier = Modifier.size(18.dp))
                                }
                                IconButton(
                                    onClick = { viewingCheque = chq },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(Icons.Default.Visibility, contentDescription = "عرض", tint = PrimaryBlue, modifier = Modifier.size(18.dp))
                                }
                                IconButton(
                                    onClick = { viewModel.deleteCheque(chq.id) },
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

        // Add Cheque Dialog
        if (showAddDialog) {
            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("تسجيل شيك جديد", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = chequeNumber,
                                onValueChange = { chequeNumber = it },
                                label = { Text("رقم الشيك") },
                                modifier = Modifier.weight(1f),
                                singleLine = true
                            )
                            OutlinedTextField(
                                value = invoiceNumber,
                                onValueChange = { invoiceNumber = it },
                                label = { Text("رقم الفاتورة المرتبطة") },
                                modifier = Modifier.weight(1f),
                                singleLine = true
                            )
                        }
                        OutlinedTextField(
                            value = amountStr,
                            onValueChange = { amountStr = it },
                            label = { Text("المبلغ (دج)") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = beneficiary,
                            onValueChange = { beneficiary = it },
                            label = { Text("اسم المستفيد") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = bank,
                            onValueChange = { bank = it },
                            label = { Text("البنك المسحوب عليه") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = issueDate,
                                onValueChange = { issueDate = it },
                                label = { Text("تاريخ الإصدار") },
                                modifier = Modifier.weight(1f),
                                singleLine = true
                            )
                            OutlinedTextField(
                                value = dueDate,
                                onValueChange = { dueDate = it },
                                label = { Text("تاريخ الاستحقاق") },
                                modifier = Modifier.weight(1f),
                                singleLine = true
                            )
                        }
                        OutlinedTextField(
                            value = notes,
                            onValueChange = { notes = it },
                            label = { Text("ملاحظات") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val amt = amountStr.toDoubleOrNull() ?: 0.0
                            if (chequeNumber.isNotBlank() && amt > 0 && beneficiary.isNotBlank()) {
                                viewModel.addCheque(chequeNumber, invoiceNumber, amt, beneficiary, bank, issueDate, dueDate, status, notes)
                                showAddDialog = false
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                    ) {
                        Text("حفظ الشيك")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showAddDialog = false }) { Text("إلغاء") }
                }
            )
        }

        // View Cheque Dialog
        viewingCheque?.let { chq ->
            AlertDialog(
                onDismissRequest = { viewingCheque = null },
                title = { Text("تفاصيل الشيك", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("رقم الشيك: ${chq.chequeNumber}", fontWeight = FontWeight.Bold, color = DeepBlue)
                        Text("رقم الفاتورة المرتبطة: ${chq.invoiceNumber}")
                        Text("المبلغ: ${String.format("%,.0f", chq.amount)} دج", fontWeight = FontWeight.Bold)
                        Text("المستفيد: ${chq.beneficiary}")
                        Text("البنك: ${chq.bank}")
                        Text("تاريخ الإصدار: ${chq.issueDate}")
                        Text("تاريخ الاستحقاق: ${chq.dueDate}")
                        Text("الحالة: ${chq.status}")
                        if (chq.notes.isNotBlank()) {
                            Text("ملاحظات: ${chq.notes}")
                        }
                    }
                },
                confirmButton = {
                    Button(onClick = { viewingCheque = null }) { Text("إغلاق") }
                }
            )
        }

        // Cheque Image / Document Dialog
        showImageDialog?.let { chq ->
            AlertDialog(
                onDismissRequest = { showImageDialog = null },
                title = { Text("صورة الشيك والمستندات المرتبطة", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("شيك رقم: ${chq.chequeNumber} (${String.format("%,.0f", chq.amount)} دج)")
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(180.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFFE2E8F0)),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(Icons.Default.ReceiptLong, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(48.dp))
                                Spacer(modifier = Modifier.height(8.dp))
                                Text("صورة الشيك الرسمي • ${chq.bank}", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = DeepBlue)
                                Text("المستفيد: ${chq.beneficiary}", fontSize = 11.sp, color = Color(0xFF059669))
                            }
                        }
                    }
                },
                confirmButton = {
                    Button(onClick = { showImageDialog = null }) { Text("إغلاق") }
                }
            )
        }
    }
}
