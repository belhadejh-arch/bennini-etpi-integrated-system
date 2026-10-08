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
import com.example.benninietpi.data.RentalItem
import com.example.benninietpi.ui.MainViewModel
import com.example.benninietpi.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RentalScreen(viewModel: MainViewModel) {
    val rentals by viewModel.rentals.collectAsState()

    var showAddDialog by remember { mutableStateOf(false) }
    var viewingRental by remember { mutableStateOf<RentalItem?>(null) }
    var showDocDialog by remember { mutableStateOf<RentalItem?>(null) }

    // Form state
    var equipment by remember { mutableStateOf("") }
    var clientOrOwner by remember { mutableStateOf("") }
    var startDate by remember { mutableStateOf("2026-10-01") }
    var endDate by remember { mutableStateOf("2026-12-01") }
    var duration by remember { mutableStateOf("شهرين") }
    var rate by remember { mutableStateOf("100,000 دج / شهرياً") }
    var totalAmountStr by remember { mutableStateOf("") }
    var paidAmountStr by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("جاري") }
    var notes by remember { mutableStateOf("") }

    val totalRemaining = rentals.sumOf { it.remainingAmount }
    val totalPaid = rentals.sumOf { it.paidAmount }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("قسم الكراء والآليات والممتلكات 🏗️", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DeepBlue, titleContentColor = Color.White)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    equipment = ""
                    clientOrOwner = ""
                    totalAmountStr = ""
                    paidAmountStr = ""
                    notes = ""
                    showAddDialog = true
                },
                containerColor = BrandYellow,
                contentColor = DeepBlue
            ) {
                Icon(Icons.Default.Add, contentDescription = "إضافة عملية كراء جديدة")
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
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = PrimaryBlue),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text("إجمالي المبالغ المتبقية في الكراء", color = Color(0xFFCBD5E1), fontSize = 13.sp)
                        Text(
                            text = "${String.format("%,.0f", totalRemaining)} دج",
                            color = Color.White,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Black,
                            modifier = Modifier.padding(vertical = 6.dp)
                        )
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("المدفوع: ${String.format("%,.0f", totalPaid)} دج", color = Color(0xFF10B981), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Text("العقود النشطة: ${rentals.count { it.status == "جاري" }}", color = Color(0xFFF5B41E), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            item {
                Text("عقود الكراء والآليات (${rentals.size})", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = DeepBlue)
            }

            items(rentals) { rnt ->
                Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(rnt.equipment, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = DeepBlue)
                                Text("المستأجر / المؤجر: ${rnt.clientOrOwner}", fontSize = 12.sp, color = TextSecondary)
                            }
                            Badge(
                                containerColor = if (rnt.status == "جاري") Color(0xFFECFDF5) else Color(0xFFF1F5F9)
                            ) {
                                Text(
                                    text = rnt.status,
                                    color = if (rnt.status == "جاري") Color(0xFF059669) else Color(0xFF475569),
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
                                Text("الإجمالي", fontSize = 10.sp, color = TextSecondary)
                                Text("${String.format("%,.0f", rnt.totalAmount)} دج", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = DeepBlue)
                            }
                            Column {
                                Text("المدفوع", fontSize = 10.sp, color = TextSecondary)
                                Text("${String.format("%,.0f", rnt.paidAmount)} دج", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFF059669))
                            }
                            Column {
                                Text("المتبقي", fontSize = 10.sp, color = TextSecondary)
                                Text("${String.format("%,.0f", rnt.remainingAmount)} دج", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = if (rnt.remainingAmount > 0) Color(0xFFEF4444) else Color(0xFF059669))
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("الفترة: ${rnt.startDate} إلى ${rnt.endDate} (${rnt.duration})", fontSize = 11.sp, color = TextSecondary)

                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                if (rnt.hasDocument) {
                                    IconButton(
                                        onClick = { showDocDialog = rnt },
                                        modifier = Modifier.size(32.dp)
                                    ) {
                                        Icon(Icons.Default.Description, contentDescription = "العقد والمستندات", tint = PrimaryBlue, modifier = Modifier.size(18.dp))
                                    }
                                }
                                IconButton(
                                    onClick = { viewingRental = rnt },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(Icons.Default.Visibility, contentDescription = "عرض", tint = PrimaryBlue, modifier = Modifier.size(18.dp))
                                }
                                IconButton(
                                    onClick = { viewModel.deleteRental(rnt.id) },
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

        // Add Rental Dialog
        if (showAddDialog) {
            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("إنشاء عقد كراء جديد", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(
                            value = equipment,
                            onValueChange = { equipment = it },
                            label = { Text("الشيء المؤجر (آلية / معدة / عقار)") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = clientOrOwner,
                            onValueChange = { clientOrOwner = it },
                            label = { Text("اسم المستأجر / المؤجر") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = startDate,
                                onValueChange = { startDate = it },
                                label = { Text("تاريخ البداية") },
                                modifier = Modifier.weight(1f),
                                singleLine = true
                            )
                            OutlinedTextField(
                                value = endDate,
                                onValueChange = { endDate = it },
                                label = { Text("تاريخ النهاية") },
                                modifier = Modifier.weight(1f),
                                singleLine = true
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = totalAmountStr,
                                onValueChange = { totalAmountStr = it },
                                label = { Text("المبلغ الإجمالي (دج)") },
                                modifier = Modifier.weight(1f),
                                singleLine = true
                            )
                            OutlinedTextField(
                                value = paidAmountStr,
                                onValueChange = { paidAmountStr = it },
                                label = { Text("المبلغ المدفوع (دج)") },
                                modifier = Modifier.weight(1f),
                                singleLine = true
                            )
                        }
                        OutlinedTextField(
                            value = rate,
                            onValueChange = { rate = it },
                            label = { Text("السعر اليومي أو الشهري") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
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
                            val tot = totalAmountStr.toDoubleOrNull() ?: 0.0
                            val paid = paidAmountStr.toDoubleOrNull() ?: 0.0
                            if (equipment.isNotBlank() && tot > 0) {
                                viewModel.addRental(equipment, clientOrOwner, startDate, endDate, duration, rate, tot, paid, status, notes)
                                showAddDialog = false
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                    ) {
                        Text("حفظ عقد الكراء")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showAddDialog = false }) { Text("إلغاء") }
                }
            )
        }

        // View Details Dialog
        viewingRental?.let { rnt ->
            AlertDialog(
                onDismissRequest = { viewingRental = null },
                title = { Text("تفاصيل عقد الكراء", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("الشيء المؤجر: ${rnt.equipment}", fontWeight = FontWeight.Bold, color = DeepBlue)
                        Text("المستأجر / المؤجر: ${rnt.clientOrOwner}")
                        Text("الفترة: ${rnt.startDate} إلى ${rnt.endDate} (${rnt.duration})")
                        Text("السعر: ${rnt.rate}")
                        Text("المبلغ الإجمالي: ${String.format("%,.0f", rnt.totalAmount)} دج", fontWeight = FontWeight.Bold)
                        Text("المبلغ المدفوع: ${String.format("%,.0f", rnt.paidAmount)} دج", color = Color(0xFF059669))
                        Text("المبلغ المتبقي: ${String.format("%,.0f", rnt.remainingAmount)} دج", color = Color(0xFFEF4444), fontWeight = FontWeight.Bold)
                        Text("حالة الكراء: ${rnt.status}")
                        if (rnt.notes.isNotBlank()) {
                            Text("ملاحظات: ${rnt.notes}")
                        }
                    }
                },
                confirmButton = {
                    Button(onClick = { viewingRental = null }) { Text("إغلاق") }
                }
            )
        }

        // Contract Document Dialog
        showDocDialog?.let { rnt ->
            AlertDialog(
                onDismissRequest = { showDocDialog = null },
                title = { Text("عقد الكراء والمستندات المرفقة", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("العقد الخاص بـ: ${rnt.equipment} (${rnt.clientOrOwner})")
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
                                Text("عقد الكراء الرسمي موثق • ${rnt.duration}", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = DeepBlue)
                                Text("المتبقي: ${String.format("%,.0f", rnt.remainingAmount)} دج", fontSize = 11.sp, color = Color(0xFF059669))
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
