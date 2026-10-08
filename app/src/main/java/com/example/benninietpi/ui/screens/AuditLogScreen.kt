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
fun AuditLogScreen(viewModel: MainViewModel) {
    val logs by viewModel.auditLogs.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("سجل التدقيق والعمليات", fontWeight = FontWeight.Bold) },
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
                Text("سجل النشاطات والتعديلات الحساسة", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = DeepBlue)
            }

            items(logs) { log ->
                Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(log.action, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = DeepBlue)
                            Text(log.timestamp, fontSize = 11.sp, color = TextSecondary)
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(log.details, fontSize = 12.sp, color = TextSecondary)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("بواسطة: ${log.performedBy}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = PrimaryBlue)
                    }
                }
            }
        }
    }
}
