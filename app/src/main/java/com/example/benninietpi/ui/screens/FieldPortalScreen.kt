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
fun FieldPortalScreen(viewModel: MainViewModel) {
    val fieldExpenses by viewModel.fieldExpenses.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }

    var category by remember { mutableStateOf("مازوت وقود") }
    var amountStr by remember { mutableStateOf("") }
    var siteName by remember { mutableStateOf("ورشة رويبة المركزية") }
    var details by remember { mutableStateOf("") }
    var litersStr by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("بوابة تطبيق رئيس الأشغال الميداني 📱", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DeepBlue, titleContentColor = Color.White)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddDialog = true },
                containerColor = BrandYellow,
                contentColor = DeepBlue
            ) {
                Icon(Icons.Default.Add, contentDescription = "تسجيل مصروف ميداني")
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
                Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF3C7))) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("مزامنة فورية مع الصدارة المركزية", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = DeepBlue)
                        Text(
                            "يمكن لرئيس الأشغال توثيق مصاريف المازوت، الوقود، وقطع الغيار مباشرة من الميدان ليتم تحديث حسابات الشركة آلياً.",
                            fontSize = 12.sp,
                            color = TextSecondary,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                }
            }

            item {
                Text("سجل مصاريف الورشات والميدان", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = DeepBlue)
            }

            items(fieldExpenses) { exp ->
                Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(exp.category, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = DeepBlue)
                            Badge(containerColor = Color(0xFFECFDF5)) {
                                Text("✓ متزامن سحابياً", color = Color(0xFF059669), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("الورشة: ${exp.siteName} • بواسطة: ${exp.createdByName}", fontSize = 13.sp, color = TextSecondary)
                        Text("التفاصيل: ${exp.details} ${exp.fuelLiters?.let { "(${it} لتر)" } ?: ""}", fontSize = 12.sp, color = DeepBlue)
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(exp.createdAt, fontSize = 11.sp, color = TextSecondary)
                            Text("${String.format("%,.0f", exp.amount)} دج", fontWeight = FontWeight.Black, fontSize = 14.sp, color = DeepBlue)
                        }
                    }
                }
            }
        }

        if (showAddDialog) {
            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("تسجيل مصروف ميداني جديد", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedTextField(
                            value = category,
                            onValueChange = { category = it },
                            label = { Text("الفئة (مثل: مازوت وقود / صيانة)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = amountStr,
                            onValueChange = { amountStr = it },
                            label = { Text("المبلغ (دج)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = siteName,
                            onValueChange = { siteName = it },
                            label = { Text("اسم الورشة أو الموقع") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = litersStr,
                            onValueChange = { litersStr = it },
                            label = { Text("كمية الوقود باللتر (اختياري)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = details,
                            onValueChange = { details = it },
                            label = { Text("التفاصيل والبيان") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val amt = amountStr.toDoubleOrNull() ?: 0.0
                            val liters = litersStr.toDoubleOrNull()
                            if (amt > 0) {
                                viewModel.addFieldExpense(category, amt, siteName, details.ifBlank { "مصروف ميداني" }, liters)
                                showAddDialog = false
                                amountStr = ""
                                details = ""
                                litersStr = ""
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                    ) {
                        Text("إرسال فوري للمركز")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showAddDialog = false }) { Text("إلغاء") }
                }
            )
        }
    }
}
