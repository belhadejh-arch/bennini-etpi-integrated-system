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
import com.example.benninietpi.data.InventoryItem
import com.example.benninietpi.ui.MainViewModel
import com.example.benninietpi.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InventoryScreen(viewModel: MainViewModel) {
    val inventory by viewModel.inventory.collectAsState()

    // Search and Filters
    var searchQuery by remember { mutableStateOf("") }
    var filterSupplier by remember { mutableStateOf("الكل") }

    // Dialogs
    var showAddDialog by remember { mutableStateOf(false) }
    var viewingItem by remember { mutableStateOf<InventoryItem?>(null) }
    var showDocDialog by remember { mutableStateOf<InventoryItem?>(null) }

    // Form state
    var itemName by remember { mutableStateOf("") }
    var quantityStr by remember { mutableStateOf("") }
    var buyPriceStr by remember { mutableStateOf("") }
    var sellPriceStr by remember { mutableStateOf("") }
    var supplier by remember { mutableStateOf("") }
    var invoiceNumber by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var hasDocument by remember { mutableStateOf(false) }

    // Totals
    val totalPurchasesCost = inventory.sumOf { it.totalCost }
    val totalExpectedProfit = inventory.sumOf { it.expectedProfit }
    val totalRealizedProfit = inventory.sumOf { it.realizedProfit }

    val suppliersList = listOf("الكل") + inventory.map { it.supplier }.distinct()

    val filteredInventory = inventory.filter { item ->
        val matchesSearch = item.name.contains(searchQuery, ignoreCase = true) ||
                item.supplier.contains(searchQuery, ignoreCase = true) ||
                item.invoiceNumber.contains(searchQuery, ignoreCase = true)
        val matchesSupplier = filterSupplier == "الكل" || item.supplier == filterSupplier
        matchesSearch && matchesSupplier
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("المشتريات والمخزون والسلع 📦", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DeepBlue, titleContentColor = Color.White)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    itemName = ""
                    quantityStr = ""
                    buyPriceStr = ""
                    sellPriceStr = ""
                    supplier = ""
                    invoiceNumber = ""
                    notes = ""
                    hasDocument = false
                    showAddDialog = true
                },
                containerColor = BrandYellow,
                contentColor = DeepBlue
            ) {
                Icon(Icons.Default.Add, contentDescription = "شراء سلعة جديدة")
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
                        Text("إجمالي قيمة المشتريات بالمخزن", color = Color(0xFFCBD5E1), fontSize = 13.sp)
                        Text(
                            text = "${String.format("%,.0f", totalPurchasesCost)} دج",
                            color = Color.White,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Black,
                            modifier = Modifier.padding(vertical = 6.dp)
                        )
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("الربح المتوقع: +${String.format("%,.0f", totalExpectedProfit)} دج", color = Color(0xFF10B981), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Text("الربح المحقق: +${String.format("%,.0f", totalRealizedProfit)} دج", color = Color(0xFFF5B41E), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Search & Filter Bar
            item {
                Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            label = { Text("بحث باسم السلعة، المورد، أو رقم الفاتورة...") },
                            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )

                        DropdownMenuFilter(
                            label = "المورد: $filterSupplier",
                            options = suppliersList,
                            onSelected = { filterSupplier = it },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("قائمة السلع والمشتريات (${filteredInventory.size})", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = DeepBlue)
                    if (searchQuery.isNotBlank() || filterSupplier != "الكل") {
                        TextButton(onClick = {
                            searchQuery = ""
                            filterSupplier = "الكل"
                        }) {
                            Text("إعادة ضبط", fontSize = 12.sp)
                        }
                    }
                }
            }

            items(filteredInventory) { item ->
                Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(item.name, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = DeepBlue)
                                Text("المورد: ${item.supplier} • فاتورة: ${item.invoiceNumber}", fontSize = 12.sp, color = TextSecondary)
                            }
                            Badge(
                                containerColor = if (item.remainingQuantity > 0) Color(0xFFECFDF5) else Color(0xFFFFF1F2)
                            ) {
                                Text(
                                    text = "المتبقي: ${item.remainingQuantity} من ${item.quantity}",
                                    color = if (item.remainingQuantity > 0) Color(0xFF059669) else Color(0xFFEF4444),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))
                        HorizontalDivider(color = Color(0xFFF1F5F9))
                        Spacer(modifier = Modifier.height(10.dp))

                        // Financial Breakdown Row
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("إجمالي التكلفة", fontSize = 10.sp, color = TextSecondary)
                                Text("${String.format("%,.0f", item.totalCost)} دج", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = DeepBlue)
                            }
                            Column {
                                Text("الربح المتوقع", fontSize = 10.sp, color = TextSecondary)
                                Text("+${String.format("%,.0f", item.expectedProfit)} دج", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFF059669))
                            }
                            Column {
                                Text("الربح المحقق", fontSize = 10.sp, color = TextSecondary)
                                Text("+${String.format("%,.0f", item.realizedProfit)} دج", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFFF5B41E))
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("تاريخ الشراء: ${item.purchaseDate}", fontSize = 11.sp, color = TextSecondary)

                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                if (item.hasDocument) {
                                    IconButton(
                                        onClick = { showDocDialog = item },
                                        modifier = Modifier.size(32.dp)
                                    ) {
                                        Icon(Icons.Default.AttachFile, contentDescription = "الفاتورة", tint = PrimaryBlue, modifier = Modifier.size(18.dp))
                                    }
                                }
                                IconButton(
                                    onClick = { viewingItem = item },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(Icons.Default.Visibility, contentDescription = "عرض", tint = PrimaryBlue, modifier = Modifier.size(18.dp))
                                }
                                IconButton(
                                    onClick = { viewModel.deleteInventoryItem(item.id) },
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

        // Add Item Dialog
        if (showAddDialog) {
            val qty = quantityStr.toIntOrNull() ?: 0
            val bPrice = buyPriceStr.toDoubleOrNull() ?: 0.0
            val sPrice = sellPriceStr.toDoubleOrNull() ?: 0.0
            val calcTotalCost = qty * bPrice
            val calcExpSales = qty * sPrice
            val calcExpProfit = calcExpSales - calcTotalCost

            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("شراء سلعة جديدة وتسجيلها بالمخزن", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(
                            value = itemName,
                            onValueChange = { itemName = it },
                            label = { Text("اسم السلعة") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = quantityStr,
                                onValueChange = { quantityStr = it },
                                label = { Text("الكمية") },
                                modifier = Modifier.weight(1f),
                                singleLine = true
                            )
                            OutlinedTextField(
                                value = invoiceNumber,
                                onValueChange = { invoiceNumber = it },
                                label = { Text("رقم الفاتورة") },
                                modifier = Modifier.weight(1f),
                                singleLine = true
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = buyPriceStr,
                                onValueChange = { buyPriceStr = it },
                                label = { Text("سعر الشراء للوحدة") },
                                modifier = Modifier.weight(1f),
                                singleLine = true
                            )
                            OutlinedTextField(
                                value = sellPriceStr,
                                onValueChange = { sellPriceStr = it },
                                label = { Text("سعر البيع المقترح") },
                                modifier = Modifier.weight(1f),
                                singleLine = true
                            )
                        }
                        OutlinedTextField(
                            value = supplier,
                            onValueChange = { supplier = it },
                            label = { Text("اسم المورد") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = notes,
                            onValueChange = { notes = it },
                            label = { Text("ملاحظات") },
                            modifier = Modifier.fillMaxWidth()
                        )

                        // Live calculation preview
                        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFEDF4FC))) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Text("الحسابات التلقائية:", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = PrimaryBlue)
                                Text("إجمالي التكلفة = ${String.format("%,.0f", calcTotalCost)} دج", fontSize = 11.sp)
                                Text("قيمة الربح المتوقعة = ${String.format("%,.0f", calcExpProfit)} دج", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF059669))
                            }
                        }

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(
                                checked = hasDocument,
                                onCheckedChange = { hasDocument = it }
                            )
                            Text("إرفاق فاتورة الشراء الرسمية", fontSize = 13.sp)
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (itemName.isNotBlank() && qty > 0 && bPrice > 0) {
                                viewModel.addInventoryItem(itemName, qty, bPrice, sPrice, supplier.ifBlank { "مورد معتمد" }, invoiceNumber, notes, hasDocument)
                                showAddDialog = false
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                    ) {
                        Text("حفظ وإضافة للمخزن")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showAddDialog = false }) { Text("إلغاء") }
                }
            )
        }

        // View Details Dialog
        viewingItem?.let { item ->
            AlertDialog(
                onDismissRequest = { viewingItem = null },
                title = { Text("تفاصيل السلعة والمخزون", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("اسم السلعة: ${item.name}", fontWeight = FontWeight.Bold, color = DeepBlue)
                        Text("المورد: ${item.supplier}")
                        Text("رقم الفاتورة: ${item.invoiceNumber}")
                        Text("تاريخ الشراء: ${item.purchaseDate}")
                        Text("الكمية المشتراة: ${item.quantity}")
                        Text("الكمية المتبقية بالمخزن: ${item.remainingQuantity}")
                        Text("سعر الشراء للوحدة: ${String.format("%,.0f", item.buyPrice)} دج")
                        Text("إجمالي التكلفة: ${String.format("%,.0f", item.totalCost)} دج", fontWeight = FontWeight.Bold)
                        Text("سعر البيع للوحدة: ${String.format("%,.0f", item.sellPrice)} دج")
                        Text("قيمة الربح المتوقعة: +${String.format("%,.0f", item.expectedProfit)} دج", color = Color(0xFF059669), fontWeight = FontWeight.Bold)
                        Text("الربح المحقق: +${String.format("%,.0f", item.realizedProfit)} دج", color = Color(0xFFF5B41E), fontWeight = FontWeight.Bold)
                        if (item.notes.isNotBlank()) {
                            Text("ملاحظات: ${item.notes}")
                        }
                        val docStatus = if (item.hasDocument) "يوجد فاتورة مرفقة ✓" else "لا يوجد"
                        Text("الفاتورة: $docStatus")
                    }
                },
                confirmButton = {
                    Button(onClick = { viewingItem = null }) { Text("إغلاق") }
                }
            )
        }

        // Document Dialog
        showDocDialog?.let { item ->
            AlertDialog(
                onDismissRequest = { showDocDialog = null },
                title = { Text("فاتورة الشراء المرفقة", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("السلعة: ${item.name} - فاتورة رقم: ${item.invoiceNumber}")
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(180.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFFE2E8F0)),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(Icons.Default.Receipt, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(48.dp))
                                Spacer(modifier = Modifier.height(8.dp))
                                Text("فاتورة المورد: ${item.supplier}", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = DeepBlue)
                                Text("الإجمالي المدفوع: ${String.format("%,.0f", item.totalCost)} دج", fontSize = 11.sp, color = Color(0xFF059669))
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
