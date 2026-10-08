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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.benninietpi.ui.MainViewModel
import com.example.benninietpi.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InventoryScreen(viewModel: MainViewModel) {
    val inventory by viewModel.inventory.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }

    var itemName by remember { mutableStateOf("") }
    var quantityStr by remember { mutableStateOf("") }
    var buyPriceStr by remember { mutableStateOf("") }

    val totalPurchases = inventory.sumOf { it.totalCost }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("إدارة المخزون والمشتريات", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DeepBlue, titleContentColor = Color.White)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddDialog = true },
                containerColor = BrandYellow,
                contentColor = DeepBlue
            ) {
                Icon(Icons.Default.Add, contentDescription = "إضافة مادة للمخزن")
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
                        Text("إجمالي مشتريات المواد والمعدات", color = Color(0xFFCBD5E1), fontSize = 13.sp)
                        Text(
                            text = "${String.format("%,.0f", totalPurchases)} دج",
                            color = Color.White,
                            fontSize = 26.sp,
                            fontWeight = FontWeight.Black,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    }
                }
            }

            item {
                Text("قائمة المواد المتوفرة بالمخزن", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = DeepBlue)
            }

            items(inventory) { item ->
                Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(item.name, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = DeepBlue)
                            Badge(containerColor = Color(0xFFFEF3C7)) {
                                Text("الكمية المتبقية: ${item.remainingQuantity}", color = Color(0xFFB45309), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("سعر الشراء: ${String.format("%,.0f", item.buyPrice)} دج", fontSize = 12.sp, color = TextSecondary)
                            Text("التكلفة الإجمالية: ${String.format("%,.0f", item.totalCost)} دج", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = DeepBlue)
                        }
                    }
                }
            }
        }

        if (showAddDialog) {
            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("إضافة مادة جديدة للمخزن", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedTextField(
                            value = itemName,
                            onValueChange = { itemName = it },
                            label = { Text("اسم المادة") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = quantityStr,
                            onValueChange = { quantityStr = it },
                            label = { Text("الكمية") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = buyPriceStr,
                            onValueChange = { buyPriceStr = it },
                            label = { Text("سعر الشراء للوحدة (دج)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val qty = quantityStr.toIntOrNull() ?: 0
                            val price = buyPriceStr.toDoubleOrNull() ?: 0.0
                            if (itemName.isNotBlank() && qty > 0) {
                                viewModel.addInventoryItem(itemName, qty, price)
                                showAddDialog = false
                                itemName = ""
                                quantityStr = ""
                                buyPriceStr = ""
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                    ) {
                        Text("إضافة للمخزن")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showAddDialog = false }) { Text("إلغاء") }
                }
            )
        }
    }
}
