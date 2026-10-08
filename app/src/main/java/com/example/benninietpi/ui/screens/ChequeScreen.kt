package com.example.benninietpi.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.benninietpi.ui.MainViewModel
import com.example.benninietpi.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChequeScreen(viewModel: MainViewModel) {
    val cheques by viewModel.cheques.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }

    var chequeNumber by remember { mutableStateOf("") }
    var amountStr by remember { mutableStateOf("") }
    var beneficiary by remember { mutableStateOf("") }
    var dueDate by remember { mutableStateOf("2026-10-30") }

    val pendingTotal = cheques.filter { it.status == "قيد الانتظار" }.sumOf { it.amount }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("دفتر الشيكات والمتابعة", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DeepBlue, titleContentColor = Color.White)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddDialog = true },
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
            item {
                Card(colors = CardDefaults.cardColors(containerColor = PrimaryBlue)) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text("إجمالي الشيكات قيد الانتظار", color = Color(0xFFCBD5E1), fontSize = 13.sp)
                        Text(
                            text = "${String.format("%,.0f", pendingTotal)} دج",
                            color = Color.White,
                            fontSize = 26.sp,
                            fontWeight = FontWeight.Black,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    }
                }
            }

            item {
                Text("قائمة الشيكات المسجلة", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = DeepBlue)
            }

            items(cheques) { chq ->
                Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("رقم الشيك: ${chq.chequeNumber}", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = DeepBlue)
                            Badge(
                                containerColor = if (chq.status == "قيد الانتظار") Color(0xFFFEF3C7) else Color(0xFFECFDF5)
                            ) {
                                Text(
                                    text = chq.status,
                                    color = if (chq.status == "قيد الانتظار") Color(0xFFB45309) else Color(0xFF059669),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("المستفيد: ${chq.beneficiary}", fontSize = 13.sp, color = TextSecondary)
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("تاريخ الاستحقاق: ${chq.dueDate}", fontSize = 12.sp, color = TextSecondary)
                            Text("${String.format("%,.0f", chq.amount)} دج", fontWeight = FontWeight.Black, fontSize = 14.sp, color = DeepBlue)
                        }
                    }
                }
            }
        }

        if (showAddDialog) {
            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("تسجيل شيك جديد", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedTextField(
                            value = chequeNumber,
                            onValueChange = { chequeNumber = it },
                            label = { Text("رقم الشيك (مثل: CHQ-98220)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = amountStr,
                            onValueChange = { amountStr = it },
                            label = { Text("المبلغ (دج)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = beneficiary,
                            onValueChange = { beneficiary = it },
                            label = { Text("المستفيد / الجهة") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = dueDate,
                            onValueChange = { dueDate = it },
                            label = { Text("تاريخ الاستحقاق (YYYY-MM-DD)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val amt = amountStr.toDoubleOrNull() ?: 0.0
                            if (chequeNumber.isNotBlank() && amt > 0) {
                                viewModel.addCheque(chequeNumber, amt, beneficiary.ifBlank { "مورد عام" }, dueDate)
                                showAddDialog = false
                                chequeNumber = ""
                                amountStr = ""
                                beneficiary = ""
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
    }
}
