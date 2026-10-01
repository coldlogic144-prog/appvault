package com.mmmut.appstore.navigation

sealed class NavRoutes(val route: String) {
    data object Splash : NavRoutes("splash")
    data object Home : NavRoutes("home")
    data object Apps : NavRoutes("apps")
    data object Search : NavRoutes("search")
    data object Updates : NavRoutes("updates")
    data object Settings : NavRoutes("settings")

    data object AppDetails : NavRoutes("app_details/{appId}") {
        fun createRoute(appId: String): String = "app_details/$appId"
    }

    data object AdminLogin : NavRoutes("admin_login")
    data object AdminDashboard : NavRoutes("admin_dashboard")
    data object AdminCreateApp : NavRoutes("admin_create_app")

    data object AdminEditApp : NavRoutes("admin_edit_app/{appId}") {
        fun createRoute(appId: String): String = "admin_edit_app/$appId"
    }

    data object AdminCreateVersion : NavRoutes("admin_create_version/{appId}") {
        fun createRoute(appId: String): String = "admin_create_version/$appId"
    }

    data object AdminManageVersions : NavRoutes("admin_manage_versions/{appId}") {
        fun createRoute(appId: String): String = "admin_manage_versions/$appId"
    }
}
