package com.example.benninietpi.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.benninietpi.ui.MainViewModel
import com.example.benninietpi.ui.theme.*

@Composable
fun DashboardScreen(viewModel: MainViewModel) {
    val profile by viewModel.profile.collectAsState()
    val transactions by viewModel.transactions.collectAsState()
    val inventory by viewModel.inventory.collectAsState()
    val cheques by viewModel.cheques.collectAsState()
    val rentals by viewModel.rentals.collectAsState()
    val fieldExpenses by viewModel.fieldExpenses.collectAsState()

    // Computed metrics
    val currentBalance = transactions.firstOrNull()?.balanceAfter ?: 12840000.0
    val totalIncome = transactions.filter { it.type == "دخل" }.sumOf { it.amount }
    val totalExpense = transactions.filter { it.type == "مصروف" || it.type == "خرج" }.sumOf { it.amount }
    val totalPurchases = inventory.sumOf { it.totalCost }
    val inventoryStockValue = inventory.sumOf { it.remainingQuantity * it.buyPrice }
    val pendingChequesTotal = cheques.filter { it.status == "قيد الانتظار" }.sumOf { it.amount }
    val dueChequesCount = cheques.filter { it.status == "قيد الانتظار" }.size
    val remainingRentalTotal = rentals.sumOf { it.remainingAmount }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundLight)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Welcome Banner with Bennini ETPI branding
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(DeepBlue, PrimaryBlue, AccentBlue)
                        )
                    )
                    .padding(20.dp)
            ) {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = RoundedCornerShape(20.dp),
                            color = BrandYellow
                        ) {
                            Text(
                                text = "BENNINI ETPI • النظام المتكامل",
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = DeepBlue
                            )
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.WbSunny, contentDescription = null, tint = BrandYellow, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("24°C • البليدة / رويبة", color = Color.White, fontSize = 12.sp)
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "مرحباً بك، ${profile.name}",
                        color = Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "إدارة الأشغال العمومية والصناعية • متابعة الصندوق والمشتريات والميدان في الوقت الحقيقي.",
                        color = Color(0xFFE2E8F0),
                        fontSize = 13.sp,
                        modifier = Modifier.padding(top = 4.dp)
                    )

                    Spacer(modifier = Modifier.height(16.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = { viewModel.navigateTo("finance") },
                            colors = ButtonDefaults.buttonColors(containerColor = BrandYellow, contentColor = DeepBlue)
                        ) {
                            Text("التسيير المالي وصندوق الشركة", fontWeight = FontWeight.Bold)
                        }
                        OutlinedButton(
                            onClick = { viewModel.navigateTo("field") },
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
                        ) {
                            Text("بوابة رئيس الأشغال")
                        }
                    }
                }
            }
        }

        // Section Header
        item {
            Text(
                text = "الإحصائيات والمؤشرات الرئيسية (انقر للاستعراض)",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = DeepBlue
            )
        }

        // All 8+ Requested Statistics Cards Grid (Clickable)
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // Row 1: Current Balance & Total Incoming
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { viewModel.navigateTo("finance") },
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(2.dp)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Icon(Icons.Default.AccountBalanceWallet, contentDescription = null, tint = AccentBlue)
                                Badge(containerColor = Color(0xFFECFDF5)) { Text("رئيسي", color = Color(0xFF059669), fontSize = 10.sp) }
                            }
                            Text("الرصيد الحالي", fontSize = 11.sp, color = TextSecondary, modifier = Modifier.padding(top = 8.dp))
                            Text("${String.format("%,.0f", currentBalance)} دج", fontSize = 16.sp, fontWeight = FontWeight.Black, color = DeepBlue)
                        }
                    }

                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { viewModel.navigateTo("finance") },
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(2.dp)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Icon(Icons.Default.TrendingUp, contentDescription = null, tint = Color(0xFF10B981))
                                Badge(containerColor = Color(0xFFECFDF5)) { Text("دخل", color = Color(0xFF059669), fontSize = 10.sp) }
                            }
                            Text("إجمالي الأموال الداخلة", fontSize = 11.sp, color = TextSecondary, modifier = Modifier.padding(top = 8.dp))
                            Text("+${String.format("%,.0f", totalIncome)} دج", fontSize = 15.sp, fontWeight = FontWeight.Black, color = Color(0xFF059669))
                        }
                    }
                }

                // Row 2: Total Outgoing & Total Purchases
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { viewModel.navigateTo("finance") },
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(2.dp)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Icon(Icons.Default.TrendingDown, contentDescription = null, tint = Color(0xFFEF4444))
                                Badge(containerColor = Color(0xFFFFF1F2)) { Text("خرج", color = Color(0xFFEF4444), fontSize = 10.sp) }
                            }
                            Text("إجمالي الأموال الخارجة", fontSize = 11.sp, color = TextSecondary, modifier = Modifier.padding(top = 8.dp))
                            Text("-${String.format("%,.0f", totalExpense)} دج", fontSize = 15.sp, fontWeight = FontWeight.Black, color = Color(0xFFEF4444))
                        }
                    }

                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { viewModel.navigateTo("inventory") },
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(2.dp)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Icon(Icons.Default.ShoppingCart, contentDescription = null, tint = BrandYellow)
                                Badge(containerColor = Color(0xFFFEF3C7)) { Text("مشتريات", color = Color(0xFFB45309), fontSize = 10.sp) }
                            }
                            Text("إجمالي المشتريات", fontSize = 11.sp, color = TextSecondary, modifier = Modifier.padding(top = 8.dp))
                            Text("${String.format("%,.0f", totalPurchases)} دج", fontSize = 15.sp, fontWeight = FontWeight.Black, color = DeepBlue)
                        }
                    }
                }

                // Row 3: Inventory Value & Pending Cheques
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { viewModel.navigateTo("inventory") },
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(2.dp)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Icon(Icons.Default.Inventory, contentDescription = null, tint = PrimaryBlue)
                                Badge(containerColor = Color(0xFFEDF4FC)) { Text("المخزن", color = PrimaryBlue, fontSize = 10.sp) }
                            }
                            Text("قيمة المخزون", fontSize = 11.sp, color = TextSecondary, modifier = Modifier.padding(top = 8.dp))
                            Text("${String.format("%,.0f", inventoryStockValue)} دج", fontSize = 15.sp, fontWeight = FontWeight.Black, color = DeepBlue)
                        }
                    }

                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { viewModel.navigateTo("cheques") },
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(2.dp)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Icon(Icons.Default.Receipt, contentDescription = null, tint = Color(0xFF64748B))
                                Badge(containerColor = Color(0xFFFFF1F2)) { Text("$dueChequesCount شيكات", color = Color(0xFFBE123C), fontSize = 10.sp) }
                            }
                            Text("الشيكات قيد الانتظار", fontSize = 11.sp, color = TextSecondary, modifier = Modifier.padding(top = 8.dp))
                            Text("${String.format("%,.0f", pendingChequesTotal)} دج", fontSize = 15.sp, fontWeight = FontWeight.Black, color = DeepBlue)
                        }
                    }
                }

                // Row 4: Due Cheques & Remaining Rental
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { viewModel.navigateTo("cheques") },
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(2.dp)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Icon(Icons.Default.Schedule, contentDescription = null, tint = Color(0xFFD97706))
                                Badge(containerColor = Color(0xFFFEF3C7)) { Text("مستحقة", color = Color(0xFFB45309), fontSize = 10.sp) }
                            }
                            Text("الشيكات المستحقة", fontSize = 11.sp, color = TextSecondary, modifier = Modifier.padding(top = 8.dp))
                            Text("$dueChequesCount شيكات", fontSize = 15.sp, fontWeight = FontWeight.Black, color = DeepBlue)
                        }
                    }

                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { viewModel.navigateTo("rentals") },
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(2.dp)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Icon(Icons.Default.BusinessCenter, contentDescription = null, tint = Color(0xFF0555A8))
                                Badge(containerColor = Color(0xFFEDF4FC)) { Text("كراء", color = PrimaryBlue, fontSize = 10.sp) }
                            }
                            Text("المبالغ المتبقية في الكراء", fontSize = 11.sp, color = TextSecondary, modifier = Modifier.padding(top = 8.dp))
                            Text("${String.format("%,.0f", remainingRentalTotal)} دج", fontSize = 15.sp, fontWeight = FontWeight.Black, color = DeepBlue)
                        }
                    }
                }
            }
        }

        // Recent Operations Section
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("آخر العمليات المسجلة", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = DeepBlue)
                TextButton(onClick = { viewModel.navigateTo("finance") }) {
                    Text("عرض الكل")
                }
            }
        }

        items(transactions.take(3)) { tx ->
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(1.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
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
                                color = if (tx.type == "دخل") Color(0xFF059669) else Color(0xFFEF4444)
                            )
                        }
                        Column {
                            Text(tx.party, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = DeepBlue)
                            Text(tx.reason, fontSize = 11.sp, color = TextSecondary)
                        }
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            text = "${String.format("%,.0f", tx.amount)} دج",
                            fontWeight = FontWeight.Black,
                            fontSize = 13.sp,
                            color = DeepBlue
                        )
                        Text(tx.date, fontSize = 10.sp, color = TextSecondary)
                    }
                }
            }
        }

        // Latest Field Foreman Expenses Section
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("آخر المصاريف المسجلة من تطبيق رئيس الأشغال", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = DeepBlue)
                TextButton(onClick = { viewModel.navigateTo("field") }) {
                    Text("فتح البوابة")
                }
            }
        }

        items(fieldExpenses.take(3)) { exp ->
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF3C7).copy(alpha = 0.5f)),
                elevation = CardDefaults.cardElevation(1.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(BrandYellow.copy(alpha = 0.3f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.LocalShipping, contentDescription = null, tint = DeepBlue, modifier = Modifier.size(20.dp))
                        }
                        Column {
                            Text("${exp.category} ${exp.fuelLiters?.let { "(${it} لتر)" } ?: ""}", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = DeepBlue)
                            Text("${exp.details} • ${exp.siteName}", fontSize = 11.sp, color = TextSecondary)
                        }
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            text = "${String.format("%,.0f", exp.amount)} دج",
                            fontWeight = FontWeight.Black,
                            fontSize = 13.sp,
                            color = DeepBlue
                        )
                        Text("✓ متزامن", fontSize = 10.sp, color = Color(0xFF059669), fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
