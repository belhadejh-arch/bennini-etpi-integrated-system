package com.example.benninietpi.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
fun RentalScreen(viewModel: MainViewModel) {
    val rentals by viewModel.rentals.collectAsState()
    val totalRemaining = rentals.sumOf { it.remainingAmount }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("كراء الآلات والعقارات", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DeepBlue, titleContentColor = Color.White)
            )
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
                        Text("إجمالي المبالغ المتبقية للكراء", color = Color(0xFFCBD5E1), fontSize = 13.sp)
                        Text(
                            text = "${String.format("%,.0f", totalRemaining)} دج",
                            color = Color.White,
                            fontSize = 26.sp,
                            fontWeight = FontWeight.Black,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    }
                }
            }

            item {
                Text("عقود الكراء والآليات النشطة", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = DeepBlue)
            }

            items(rentals) { rnt ->
                Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(rnt.equipment, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = DeepBlue)
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
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("العميل / المالك: ${rnt.clientOrOwner}", fontSize = 13.sp, color = TextSecondary)
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("المبلغ المتبقي:", fontSize = 12.sp, color = TextSecondary)
                            Text("${String.format("%,.0f", rnt.remainingAmount)} دج", fontWeight = FontWeight.Black, fontSize = 14.sp, color = if (rnt.remainingAmount > 0) Color(0xFFEF4444) else Color(0xFF059669))
                        }
                    }
                }
            }
        }
    }
}
