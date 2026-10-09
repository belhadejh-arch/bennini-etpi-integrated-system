package com.example.benninietpi

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.benninietpi.R
import com.example.benninietpi.ui.MainViewModel
import com.example.benninietpi.ui.screens.*
import com.example.benninietpi.ui.theme.*
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val viewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            BenniniETPITheme {
                MainAppScreen(viewModel)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainAppScreen(viewModel: MainViewModel) {
    val currentRoute by viewModel.currentRoute.collectAsState()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = DeepBlue,
                drawerContentColor = Color.White
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(vertical = 16.dp)
                ) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color.White,
                            modifier = Modifier.size(44.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Image(
                                    painter = painterResource(id = R.drawable.ic_bennini_logo),
                                    contentDescription = "شعار شركة بنيني",
                                    modifier = Modifier.size(36.dp)
                                )
                            }
                        }
                        Column {
                            Text(
                                text = "BENNINI ETPI",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Black,
                                color = BrandYellow
                            )
                            Text(
                                text = "إدارة الأشغال العمومية والصناعية",
                                fontSize = 10.sp,
                                color = Color(0xFFCBD5E1)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))
                    HorizontalDivider(color = Color(0xFF13274C))
                    Spacer(modifier = Modifier.height(8.dp))

                    NavigationDrawerItem(
                        icon = { Icon(Icons.Default.Dashboard, contentDescription = null, tint = Color.White) },
                        label = { Text("لوحة القيادة المركزية", color = Color.White) },
                        selected = currentRoute == "dashboard",
                        onClick = {
                            viewModel.navigateTo("dashboard")
                            scope.launch { drawerState.close() }
                        },
                        colors = NavigationDrawerItemDefaults.colors(selectedContainerColor = AccentBlue)
                    )

                    NavigationDrawerItem(
                        icon = { Icon(Icons.Default.AccountBalance, contentDescription = null, tint = Color.White) },
                        label = { Text("التسيير المالي والصندوق", color = Color.White) },
                        selected = currentRoute == "finance",
                        onClick = {
                            viewModel.navigateTo("finance")
                            scope.launch { drawerState.close() }
                        },
                        colors = NavigationDrawerItemDefaults.colors(selectedContainerColor = AccentBlue)
                    )

                    NavigationDrawerItem(
                        icon = { Icon(Icons.Default.Inventory2, contentDescription = null, tint = Color.White) },
                        label = { Text("المخزون والمشتريات", color = Color.White) },
                        selected = currentRoute == "inventory",
                        onClick = {
                            viewModel.navigateTo("inventory")
                            scope.launch { drawerState.close() }
                        },
                        colors = NavigationDrawerItemDefaults.colors(selectedContainerColor = AccentBlue)
                    )

                    NavigationDrawerItem(
                        icon = { Icon(Icons.Default.ReceiptLong, contentDescription = null, tint = Color.White) },
                        label = { Text("دفتر الشيكات", color = Color.White) },
                        selected = currentRoute == "cheques",
                        onClick = {
                            viewModel.navigateTo("cheques")
                            scope.launch { drawerState.close() }
                        },
                        colors = NavigationDrawerItemDefaults.colors(selectedContainerColor = AccentBlue)
                    )

                    NavigationDrawerItem(
                        icon = { Icon(Icons.Default.BusinessCenter, contentDescription = null, tint = Color.White) },
                        label = { Text("كراء الآلات والعقارات", color = Color.White) },
                        selected = currentRoute == "rentals",
                        onClick = {
                            viewModel.navigateTo("rentals")
                            scope.launch { drawerState.close() }
                        },
                        colors = NavigationDrawerItemDefaults.colors(selectedContainerColor = AccentBlue)
                    )

                    NavigationDrawerItem(
                        icon = { Icon(Icons.Default.LocalShipping, contentDescription = null, tint = Color.White) },
                        label = { Text("العتاد والآليات والوقود", color = Color.White) },
                        selected = currentRoute == "machinery",
                        onClick = {
                            viewModel.navigateTo("machinery")
                            scope.launch { drawerState.close() }
                        },
                        colors = NavigationDrawerItemDefaults.colors(selectedContainerColor = AccentBlue)
                    )

                    NavigationDrawerItem(
                        icon = { Icon(Icons.Default.PhoneAndroid, contentDescription = null, tint = Color.White) },
                        label = { Text("بوابة تطبيق رئيس الأشغال", color = Color.White) },
                        selected = currentRoute == "field",
                        onClick = {
                            viewModel.navigateTo("field")
                            scope.launch { drawerState.close() }
                        },
                        colors = NavigationDrawerItemDefaults.colors(selectedContainerColor = AccentBlue)
                    )

                    NavigationDrawerItem(
                        icon = { Icon(Icons.Default.Group, contentDescription = null, tint = Color.White) },
                        label = { Text("المستخدمين والصلاحيات", color = Color.White) },
                        selected = currentRoute == "users",
                        onClick = {
                            viewModel.navigateTo("users")
                            scope.launch { drawerState.close() }
                        },
                        colors = NavigationDrawerItemDefaults.colors(selectedContainerColor = AccentBlue)
                    )

                    NavigationDrawerItem(
                        icon = { Icon(Icons.Default.History, contentDescription = null, tint = Color.White) },
                        label = { Text("سجل التدقيق", color = Color.White) },
                        selected = currentRoute == "audit",
                        onClick = {
                            viewModel.navigateTo("audit")
                            scope.launch { drawerState.close() }
                        },
                        colors = NavigationDrawerItemDefaults.colors(selectedContainerColor = AccentBlue)
                    )
                }
            }
        }
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = Color.White,
                                modifier = Modifier.size(32.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Image(
                                        painter = painterResource(id = R.drawable.ic_bennini_logo),
                                        contentDescription = "شعار الشركة",
                                        modifier = Modifier.size(26.dp)
                                    )
                                }
                            }
                            Text(
                                text = when(currentRoute) {
                                    "finance" -> "التسيير المالي والصندوق"
                                    "inventory" -> "المخزون والمشتريات"
                                    "cheques" -> "دفتر الشيكات"
                                    "rentals" -> "كراء الآلات والعقارات"
                                    "machinery" -> "العتاد والآليات والوقود"
                                    "field" -> "بوابة تطبيق رئيس الأشغال"
                                    "users" -> "المستخدمين والصلاحيات"
                                    "audit" -> "سجل التدقيق"
                                    else -> "BENNINI ETPI - لوحة القيادة"
                                },
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp
                            )
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Default.Menu, contentDescription = "القائمة الرئيسية", tint = Color.White)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = DeepBlue, titleContentColor = Color.White)
                )
            },
            bottomBar = {
                NavigationBar(containerColor = DeepBlue) {
                    NavigationBarItem(
                        icon = { Icon(Icons.Default.Dashboard, contentDescription = null) },
                        label = { Text("الرئيسية", fontSize = 10.sp) },
                        selected = currentRoute == "dashboard",
                        onClick = { viewModel.navigateTo("dashboard") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = BrandYellow,
                            selectedTextColor = BrandYellow,
                            unselectedIconColor = Color.LightGray,
                            unselectedTextColor = Color.LightGray
                        )
                    )
                    NavigationBarItem(
                        icon = { Icon(Icons.Default.AccountBalance, contentDescription = null) },
                        label = { Text("المالية", fontSize = 10.sp) },
                        selected = currentRoute == "finance",
                        onClick = { viewModel.navigateTo("finance") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = BrandYellow,
                            selectedTextColor = BrandYellow,
                            unselectedIconColor = Color.LightGray,
                            unselectedTextColor = Color.LightGray
                        )
                    )
                    NavigationBarItem(
                        icon = { Icon(Icons.Default.Inventory2, contentDescription = null) },
                        label = { Text("المخزون", fontSize = 10.sp) },
                        selected = currentRoute == "inventory",
                        onClick = { viewModel.navigateTo("inventory") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = BrandYellow,
                            selectedTextColor = BrandYellow,
                            unselectedIconColor = Color.LightGray,
                            unselectedTextColor = Color.LightGray
                        )
                    )
                    NavigationBarItem(
                        icon = { Icon(Icons.Default.PhoneAndroid, contentDescription = null) },
                        label = { Text("الميدان", fontSize = 10.sp) },
                        selected = currentRoute == "field",
                        onClick = { viewModel.navigateTo("field") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = BrandYellow,
                            selectedTextColor = BrandYellow,
                            unselectedIconColor = Color.LightGray,
                            unselectedTextColor = Color.LightGray
                        )
                    )
                }
            }
        ) { padding ->
            Box(modifier = Modifier.padding(padding)) {
                when(currentRoute) {
                    "dashboard" -> DashboardScreen(viewModel)
                    "finance" -> FinanceScreen(viewModel)
                    "inventory" -> InventoryScreen(viewModel)
                    "cheques" -> ChequeScreen(viewModel)
                    "rentals" -> RentalScreen(viewModel)
                    "machinery" -> MachineryScreen(viewModel)
                    "field" -> FieldPortalScreen(viewModel)
                    "users" -> UsersScreen(viewModel)
                    "audit" -> AuditLogScreen(viewModel)
                    else -> DashboardScreen(viewModel)
                }
            }
        }
    }
}
