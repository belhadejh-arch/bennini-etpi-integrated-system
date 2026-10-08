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
fun MachineryScreen(viewModel: MainViewModel) {
    val machinery by viewModel.machinery.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("العتاد والآليات ومتابعة الوقود", fontWeight = FontWeight.Bold) },
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
                Text("أسطول الآليات والمعدات الثقيلة", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = DeepBlue)
            }

            items(machinery) { mch ->
                Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("${mch.code} - ${mch.name}", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = DeepBlue)
                            Badge(
                                containerColor = when (mch.status) {
                                    "يعمل" -> Color(0xFFECFDF5)
                                    "صيانة" -> Color(0xFFFEF3C7)
                                    else -> Color(0xFFFFF1F2)
                                }
                            ) {
                                Text(
                                    text = mch.status,
                                    color = when (mch.status) {
                                        "يعمل" -> Color(0xFF059669)
                                        "صيانة" -> Color(0xFFB45309)
                                        else -> Color(0xFFEF4444)
                                    },
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("النوع: ${mch.type} • ساعات العمل: ${mch.hoursWorked} ساعة", fontSize = 13.sp, color = TextSecondary)
                        Spacer(modifier = Modifier.height(8.dp))
                        LinearProgressIndicator(
                            progress = { mch.fuelLevelPercent / 100f },
                            modifier = Modifier.fillMaxWidth().height(8.dp),
                            color = BrandYellow,
                            trackColor = Color(0xFFE2E8F0)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("مستوى الوقود: ${mch.fuelLevelPercent}%", fontSize = 12.sp, color = TextSecondary)
                    }
                }
            }
        }
    }
}
