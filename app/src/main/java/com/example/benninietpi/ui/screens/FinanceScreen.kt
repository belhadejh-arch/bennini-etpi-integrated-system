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
import com.example.benninietpi.ui.MainViewModel
import com.example.benninietpi.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FinanceScreen(viewModel: MainViewModel) {
    val transactions by viewModel.transactions.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }

    var type by remember { mutableStateOf("دخل") }
    var amountStr by remember { mutableStateOf("") }
    var party by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("") }
    var paymentMethod by remember { mutableStateOf("تحويل بنكي") }

    val currentBalance = transactions.firstOrNull()?.balanceAfter ?: 12840000.0
    val totalIncome = transactions.filter { it.type == "دخل" }.sumOf { it.amount }
    val totalExpense = transactions.filter { it.type == "مصروف" || it.type == "خرج" }.sumOf { it.amount }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("التسيير المالي والصندوق", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DeepBlue, titleContentColor = Color.White)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddDialog = true },
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
            // Summary Cards
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = PrimaryBlue),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text("الرصيد العام بالصندوق", color = Color(0xFFCBD5E1), fontSize = 13.sp)
                        Text(
                            text = "${String.format("%,.0f", currentBalance)} دج",
                            color = Color.White,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Black,
                            modifier = Modifier.padding(vertical = 8.dp)
                        )
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("إجمالي المداخيل: +${String.format("%,.0f", totalIncome)} دج", color = Color(0xFF10B981), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Text("إجمالي المصاريف: -${String.format("%,.0f", totalExpense)} دج", color = Color(0xFFF5B41E), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            item {
                Text("سجل العمليات المالية اليومية", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = DeepBlue)
            }

            items(transactions) { tx ->
                Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (tx.type == "دخل") Color(0xFFECFDF5) else Color(0xFFFFF1F2)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = if (tx.type == "دخل") "+" else "-",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 18.sp,
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
                            Text(tx.date, fontSize = 11.sp, color = TextSecondary)
                        }
                    }
                }
            }
        }

        if (showAddDialog) {
            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("تسجيل عملية مالية جديدة", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
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
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = party,
                            onValueChange = { party = it },
                            label = { Text("الطرف (العميل / المورد)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = reason,
                            onValueChange = { reason = it },
                            label = { Text("السبب / البيان") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val amt = amountStr.toDoubleOrNull() ?: 0.0
                            if (amt > 0 && party.isNotBlank()) {
                                viewModel.addTransaction(type, amt, party, reason.ifBlank { "عملية مالية" }, paymentMethod)
                                showAddDialog = false
                                amountStr = ""
                                party = ""
                                reason = ""
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
    }
}
