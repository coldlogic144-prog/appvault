package com.mmmut.appstore.navigation

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.navArgument
import com.mmmut.appstore.di.AppContainer
import com.mmmut.appstore.ui.admin.AdminAuthViewModel
import com.mmmut.appstore.ui.admin.AdminCreateEditAppScreen
import com.mmmut.appstore.ui.admin.AdminCreateVersionScreen
import com.mmmut.appstore.ui.admin.AdminDashboardScreen
import com.mmmut.appstore.ui.admin.AdminDashboardViewModel
import com.mmmut.appstore.ui.admin.AdminLoginScreen
import com.mmmut.appstore.ui.admin.AdminManageVersionsScreen
import com.mmmut.appstore.ui.apps.AppsScreen
import com.mmmut.appstore.ui.apps.AppsViewModel
import com.mmmut.appstore.ui.components.StoreBottomBar
import com.mmmut.appstore.ui.details.AppDetailsScreen
import com.mmmut.appstore.ui.details.AppDetailsViewModel
import com.mmmut.appstore.ui.home.HomeScreen
import com.mmmut.appstore.ui.home.HomeViewModel
import com.mmmut.appstore.ui.search.SearchScreen
import com.mmmut.appstore.ui.search.SearchViewModel
import com.mmmut.appstore.ui.settings.SettingsScreen
import com.mmmut.appstore.ui.settings.SettingsViewModel
import com.mmmut.appstore.ui.splash.SplashScreen
import com.mmmut.appstore.ui.updates.UpdatesScreen
import com.mmmut.appstore.ui.updates.UpdatesViewModel

@Composable
fun AppNavHost(
    navController: NavHostController,
    container: AppContainer,
    modifier: Modifier = Modifier
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    // Show bottom navigation bar only on main tabs
    val isMainTab = currentRoute in listOf(
        NavRoutes.Home.route,
        NavRoutes.Apps.route,
        NavRoutes.Search.route,
        NavRoutes.Updates.route,
        NavRoutes.Settings.route
    )

    // Updates ViewModel at top level to badge updates tab
    val updatesViewModel: UpdatesViewModel = viewModel(
        factory = UpdatesViewModel.Factory(
            appRepository = container.appRepository,
            apkInstaller = container.apkInstaller,
            apkDownloader = container.apkDownloader
        )
    )
    val updatesState by updatesViewModel.uiState.collectAsState()
    val pendingUpdateCount = updatesState.updatableApps.size

    Scaffold(
        bottomBar = {
            if (isMainTab) {
                StoreBottomBar(
                    navController = navController,
                    updateCount = pendingUpdateCount
                )
            }
        },
        modifier = modifier.fillMaxSize()
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = NavRoutes.Splash.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            // Splash Screen
            composable(NavRoutes.Splash.route) {
                SplashScreen(
                    onSplashFinished = {
                        navController.navigate(NavRoutes.Home.route) {
                            popUpTo(NavRoutes.Splash.route) { inclusive = true }
                        }
                    }
                )
            }

            // Home Tab
            composable(NavRoutes.Home.route) {
                val homeViewModel: HomeViewModel = viewModel(
                    factory = HomeViewModel.Factory(
                        appRepository = container.appRepository,
                        networkMonitor = container.networkMonitor
                    )
                )
                HomeScreen(
                    viewModel = homeViewModel,
                    onAppClick = { appId ->
                        navController.navigate(NavRoutes.AppDetails.createRoute(appId))
                    },
                    onNavigateToApps = {
                        navController.navigate(NavRoutes.Apps.route)
                    }
                )
            }

            // Apps Tab
            composable(NavRoutes.Apps.route) {
                val appsViewModel: AppsViewModel = viewModel(
                    factory = AppsViewModel.Factory(container.appRepository)
                )
                AppsScreen(
                    viewModel = appsViewModel,
                    onAppClick = { appId ->
                        navController.navigate(NavRoutes.AppDetails.createRoute(appId))
                    }
                )
            }

            // Search Tab
            composable(NavRoutes.Search.route) {
                val searchViewModel: SearchViewModel = viewModel(
                    factory = SearchViewModel.Factory(container.appRepository)
                )
                SearchScreen(
                    viewModel = searchViewModel,
                    onAppClick = { appId ->
                        navController.navigate(NavRoutes.AppDetails.createRoute(appId))
                    }
                )
            }

            // Updates Tab
            composable(NavRoutes.Updates.route) {
                UpdatesScreen(
                    viewModel = updatesViewModel,
                    onAppClick = { appId ->
                        navController.navigate(NavRoutes.AppDetails.createRoute(appId))
                    }
                )
            }

            // Settings Tab
            composable(NavRoutes.Settings.route) {
                val settingsViewModel: SettingsViewModel = viewModel(
                    factory = SettingsViewModel.Factory(
                        context = container.context,
                        authRepository = container.authRepository
                    )
                )
                SettingsScreen(
                    viewModel = settingsViewModel,
                    onNavigateToAdminLogin = {
                        navController.navigate(NavRoutes.AdminLogin.route)
                    },
                    onNavigateToAdminDashboard = {
                        navController.navigate(NavRoutes.AdminDashboard.route)
                    }
                )
            }

            // App Details Screen
            composable(
                route = NavRoutes.AppDetails.route,
                arguments = listOf(navArgument("appId") { type = NavType.StringType })
            ) { backStackEntry ->
                val appId = backStackEntry.arguments?.getString("appId") ?: ""
                val detailsViewModel: AppDetailsViewModel = viewModel(
                    key = appId,
                    factory = AppDetailsViewModel.Factory(
                        appId = appId,
                        appRepository = container.appRepository,
                        apkInstaller = container.apkInstaller,
                        apkDownloader = container.apkDownloader
                    )
                )
                AppDetailsScreen(
                    viewModel = detailsViewModel,
                    apkInstaller = container.apkInstaller,
                    onBackClick = { navController.popBackStack() }
                )
            }

            // Admin: Login Screen
            composable(NavRoutes.AdminLogin.route) {
                val adminAuthViewModel: AdminAuthViewModel = viewModel(
                    factory = AdminAuthViewModel.Factory(container.authRepository)
                )
                AdminLoginScreen(
                    viewModel = adminAuthViewModel,
                    onLoginSuccess = {
                        navController.navigate(NavRoutes.AdminDashboard.route) {
                            popUpTo(NavRoutes.AdminLogin.route) { inclusive = true }
                        }
                    },
                    onBackClick = { navController.popBackStack() }
                )
            }

            // Admin: Dashboard Screen
            composable(NavRoutes.AdminDashboard.route) {
                val adminDashboardViewModel: AdminDashboardViewModel = viewModel(
                    factory = AdminDashboardViewModel.Factory(container.appRepository)
                )
                AdminDashboardScreen(
                    viewModel = adminDashboardViewModel,
                    onCreateAppClick = {
                        navController.navigate(NavRoutes.AdminCreateApp.route)
                    },
                    onEditAppClick = { appId ->
                        navController.navigate(NavRoutes.AdminEditApp.createRoute(appId))
                    },
                    onManageVersionsClick = { appId ->
                        navController.navigate(NavRoutes.AdminManageVersions.createRoute(appId))
                    },
                    onBackClick = { navController.popBackStack() }
                )
            }

            // Admin: Create App Screen
            composable(NavRoutes.AdminCreateApp.route) {
                AdminCreateEditAppScreen(
                    appId = null,
                    appRepository = container.appRepository,
                    storageRepository = container.storageRepository,
                    onSuccess = { navController.popBackStack() },
                    onBackClick = { navController.popBackStack() }
                )
            }

            // Admin: Edit App Screen
            composable(
                route = NavRoutes.AdminEditApp.route,
                arguments = listOf(navArgument("appId") { type = NavType.StringType })
            ) { backStackEntry ->
                val appId = backStackEntry.arguments?.getString("appId") ?: ""
                AdminCreateEditAppScreen(
                    appId = appId,
                    appRepository = container.appRepository,
                    storageRepository = container.storageRepository,
                    onSuccess = { navController.popBackStack() },
                    onBackClick = { navController.popBackStack() }
                )
            }

            // Admin: Create Version Screen
            composable(
                route = NavRoutes.AdminCreateVersion.route,
                arguments = listOf(navArgument("appId") { type = NavType.StringType })
            ) { backStackEntry ->
                val appId = backStackEntry.arguments?.getString("appId") ?: ""
                AdminCreateVersionScreen(
                    appId = appId,
                    appRepository = container.appRepository,
                    onSuccess = { navController.popBackStack() },
                    onBackClick = { navController.popBackStack() }
                )
            }

            // Admin: Manage Versions Screen
            composable(
                route = NavRoutes.AdminManageVersions.route,
                arguments = listOf(navArgument("appId") { type = NavType.StringType })
            ) { backStackEntry ->
                val appId = backStackEntry.arguments?.getString("appId") ?: ""
                AdminManageVersionsScreen(
                    appId = appId,
                    appRepository = container.appRepository,
                    onAddNewVersionClick = {
                        navController.navigate(NavRoutes.AdminCreateVersion.createRoute(appId))
                    },
                    onBackClick = { navController.popBackStack() }
                )
            }
        }
    }
}
