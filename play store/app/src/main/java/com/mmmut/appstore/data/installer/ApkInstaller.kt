package com.mmmut.appstore.data.installer

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.content.FileProvider
import com.mmmut.appstore.data.model.DeviceAppInfo
import com.mmmut.appstore.data.model.InstalledAppInfo
import java.io.File

class ApkInstaller(private val context: Context) {

    private val prefs by lazy {
        context.getSharedPreferences("app_package_registry", Context.MODE_PRIVATE)
    }

    /**
     * Inspects downloaded APK binary to parse and record its actual package name,
     * version code, and version name, ensuring accurate detection post-install.
     */
    fun recordDownloadedApk(apkFile: File, appId: String? = null) {
        try {
            val archiveInfo = context.packageManager.getPackageArchiveInfo(apkFile.absolutePath, 0)
            if (archiveInfo != null) {
                val realPkg = archiveInfo.packageName
                if (!realPkg.isNullOrBlank()) {
                    val editor = prefs.edit()
                    if (!appId.isNullOrBlank()) {
                        editor.putString("appId_$appId", realPkg)
                        editor.putString("pkg_$realPkg", appId)
                    }
                    editor.apply()
                    Log.d("ApkInstaller", "Recorded downloaded APK package '$realPkg' for appId '$appId'")
                }
            }
        } catch (e: Exception) {
            Log.w("ApkInstaller", "Failed to parse downloaded APK archive info", e)
        }
    }

    /**
     * Scans and retrieves all applications installed on this physical device.
     * Uses multiple package queries to ensure complete visibility across all Android versions.
     */
    fun getInstalledDeviceApps(includeSystemApps: Boolean = false): List<DeviceAppInfo> {
        val pm = context.packageManager
        val packageMap = linkedMapOf<String, PackageInfo>()

        // Strategy A: getInstalledPackages
        try {
            val list = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.getInstalledPackages(PackageManager.PackageInfoFlags.of(0))
            } else {
                @Suppress("DEPRECATION")
                pm.getInstalledPackages(0)
            }
            for (pkg in list) {
                packageMap[pkg.packageName] = pkg
            }
        } catch (e: Exception) {
            Log.w("ApkInstaller", "Error calling getInstalledPackages", e)
        }

        // Strategy B: queryIntentActivities for launcher apps to capture all visible user-facing apps
        try {
            val launcherIntent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            val resolveList = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.queryIntentActivities(launcherIntent, PackageManager.ResolveInfoFlags.of(0))
            } else {
                @Suppress("DEPRECATION")
                pm.queryIntentActivities(launcherIntent, 0)
            }
            for (resolveInfo in resolveList) {
                val pkgName = resolveInfo.activityInfo?.packageName ?: continue
                if (!packageMap.containsKey(pkgName)) {
                    try {
                        val pInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            pm.getPackageInfo(pkgName, PackageManager.PackageInfoFlags.of(0))
                        } else {
                            @Suppress("DEPRECATION")
                            pm.getPackageInfo(pkgName, 0)
                        }
                        packageMap[pkgName] = pInfo
                    } catch (_: Exception) {}
                }
            }
        } catch (e: Exception) {
            Log.w("ApkInstaller", "Error querying launcher intent activities", e)
        }

        val result = mutableListOf<DeviceAppInfo>()
        for ((pkgName, pInfo) in packageMap) {
            val appInfo = pInfo.applicationInfo
            val isSystem = if (appInfo != null) {
                val isSys = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0
                val isUpdatedSys = (appInfo.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0
                isSys && !isUpdatedSys
            } else {
                false
            }

            if (isSystem && !includeSystemApps) {
                continue
            }

            val appLabel = if (appInfo != null) {
                try {
                    pm.getApplicationLabel(appInfo).toString()
                } catch (_: Exception) {
                    pkgName
                }
            } else {
                pkgName
            }

            val vCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                pInfo.longVersionCode
            } else {
                @Suppress("DEPRECATION")
                pInfo.versionCode.toLong()
            }

            result.add(
                DeviceAppInfo(
                    packageName = pkgName,
                    appName = appLabel.ifBlank { pkgName },
                    versionName = pInfo.versionName ?: "",
                    versionCode = vCode,
                    isSystemApp = isSystem,
                    firstInstallTime = pInfo.firstInstallTime,
                    lastUpdateTime = pInfo.lastUpdateTime
                )
            )
        }

        return result.sortedBy { it.appName.lowercase() }
    }

    /**
     * Inspects device packages to determine if [packageName] is installed,
     * its installed version code, and whether [storeVersionCode] is an update.
     */
    fun getInstalledAppInfo(
        packageName: String,
        storeVersionName: String = "",
        storeVersionCode: Long = 0L,
        appName: String = "",
        appId: String = ""
    ): InstalledAppInfo {
        val cleanPackage = packageName.trim()
        val mappedPackage = if (appId.isNotBlank()) prefs.getString("appId_$appId", null) else null

        val candidates = linkedSetOf<String>()
        if (!mappedPackage.isNullOrBlank()) {
            candidates.add(mappedPackage)
        }
        if (cleanPackage.isNotBlank()) {
            candidates.add(cleanPackage)
            candidates.add(cleanPackage.lowercase())
            candidates.add("$cleanPackage.debug")
            candidates.add(cleanPackage.removeSuffix(".debug"))
        }

        if (candidates.isEmpty() && appName.isBlank()) {
            return InstalledAppInfo(
                packageName = "",
                versionName = "",
                versionCode = 0L,
                isInstalled = false,
                hasUpdate = false,
                latestStoreVersionName = storeVersionName,
                latestStoreVersionCode = storeVersionCode,
                resolvedPackageName = ""
            )
        }

        val pm = context.packageManager
        var resolvedPackageInfo: PackageInfo? = null
        var matchedPackageName = cleanPackage.ifBlank { mappedPackage ?: "" }

        // Strategy 1: Direct getPackageInfo lookup across candidates
        for (candidate in candidates) {
            try {
                val pInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    pm.getPackageInfo(candidate, PackageManager.PackageInfoFlags.of(0))
                } else {
                    @Suppress("DEPRECATION")
                    pm.getPackageInfo(candidate, 0)
                }
                resolvedPackageInfo = pInfo
                matchedPackageName = candidate
                break
            } catch (_: PackageManager.NameNotFoundException) {
                // Try next candidate
            } catch (e: Exception) {
                Log.w("ApkInstaller", "getPackageInfo error for $candidate", e)
            }
        }

        // Strategy 2: Check launch intent for package
        if (resolvedPackageInfo == null) {
            for (candidate in candidates) {
                try {
                    val launchIntent = pm.getLaunchIntentForPackage(candidate)
                    if (launchIntent != null) {
                        val pInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            pm.getPackageInfo(candidate, PackageManager.PackageInfoFlags.of(0))
                        } else {
                            @Suppress("DEPRECATION")
                            pm.getPackageInfo(candidate, 0)
                        }
                        resolvedPackageInfo = pInfo
                        matchedPackageName = candidate
                        break
                    }
                } catch (_: Exception) {}
            }
        }

        // Strategy 3: Query launcher Intent activities
        if (resolvedPackageInfo == null) {
            for (candidate in candidates) {
                try {
                    val mainIntent = Intent(Intent.ACTION_MAIN).apply {
                        addCategory(Intent.CATEGORY_LAUNCHER)
                        `package` = candidate
                    }
                    val resolveList = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        pm.queryIntentActivities(mainIntent, PackageManager.ResolveInfoFlags.of(0))
                    } else {
                        @Suppress("DEPRECATION")
                        pm.queryIntentActivities(mainIntent, 0)
                    }
                    if (resolveList.isNotEmpty()) {
                        val actualPkg = resolveList.first().activityInfo?.packageName ?: candidate
                        val pInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            pm.getPackageInfo(actualPkg, PackageManager.PackageInfoFlags.of(0))
                        } else {
                            @Suppress("DEPRECATION")
                            pm.getPackageInfo(actualPkg, 0)
                        }
                        resolvedPackageInfo = pInfo
                        matchedPackageName = actualPkg
                        break
                    }
                } catch (_: Exception) {}
            }
        }

        // Strategy 4: Fallback scan through all installed packages visible on device
        if (resolvedPackageInfo == null) {
            try {
                val installedPackages = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    pm.getInstalledPackages(PackageManager.PackageInfoFlags.of(0))
                } else {
                    @Suppress("DEPRECATION")
                    pm.getInstalledPackages(0)
                }

                val cleanLower = cleanPackage.lowercase()
                val appNameTrimmed = appName.trim().lowercase()

                // Check 4a: Candidate package name match (case-insensitive)
                for (p in installedPackages) {
                    val pNameLower = p.packageName.lowercase()
                    if (candidates.any { it.equals(pNameLower, ignoreCase = true) }) {
                        resolvedPackageInfo = p
                        matchedPackageName = p.packageName
                        break
                    }
                }

                // Check 4b: Package ends with or contains significant component
                if (resolvedPackageInfo == null && cleanLower.isNotBlank() && cleanLower.contains(".")) {
                    val lastSegment = cleanLower.substringAfterLast(".")
                    if (lastSegment.length >= 3) {
                        for (p in installedPackages) {
                            val pNameLower = p.packageName.lowercase()
                            if (pNameLower.endsWith(".$lastSegment") || pNameLower.endsWith(".$lastSegment.debug")) {
                                resolvedPackageInfo = p
                                matchedPackageName = p.packageName
                                break
                            }
                        }
                    }
                }

                // Check 4c: Fallback by Application Label / Title match
                if (resolvedPackageInfo == null && appNameTrimmed.isNotBlank()) {
                    for (p in installedPackages) {
                        val label = try {
                            p.applicationInfo?.let { pm.getApplicationLabel(it).toString().trim().lowercase() }
                        } catch (_: Exception) {
                            null
                        }
                        if (label != null && label == appNameTrimmed) {
                            resolvedPackageInfo = p
                            matchedPackageName = p.packageName
                            break
                        }
                    }
                }
            } catch (e: Exception) {
                Log.w("ApkInstaller", "Error reading getInstalledPackages", e)
            }
        }

        if (resolvedPackageInfo != null) {
            val installedVersionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                resolvedPackageInfo.longVersionCode
            } else {
                @Suppress("DEPRECATION")
                resolvedPackageInfo.versionCode.toLong()
            }
            val installedVersionName = resolvedPackageInfo.versionName ?: ""

            val hasUpdate = when {
                storeVersionCode > 0L && installedVersionCode > 0L -> storeVersionCode > installedVersionCode
                storeVersionName.isNotBlank() && installedVersionName.isNotBlank() -> isVersionNameNewer(storeVersionName, installedVersionName)
                else -> false
            }

            Log.d("ApkInstaller", "Detected installed app '$matchedPackageName': v$installedVersionName (code: $installedVersionCode), store v$storeVersionName (code: $storeVersionCode), hasUpdate=$hasUpdate")

            // Remember mapped package for appId if provided
            if (appId.isNotBlank() && matchedPackageName.isNotBlank()) {
                prefs.edit().putString("appId_$appId", matchedPackageName).apply()
            }

            return InstalledAppInfo(
                packageName = cleanPackage.ifBlank { matchedPackageName },
                versionName = installedVersionName,
                versionCode = installedVersionCode,
                isInstalled = true,
                hasUpdate = hasUpdate,
                latestStoreVersionName = storeVersionName,
                latestStoreVersionCode = storeVersionCode,
                resolvedPackageName = matchedPackageName
            )
        }

        Log.d("ApkInstaller", "App '$cleanPackage' (name: '$appName') not found among installed packages")
        return InstalledAppInfo(
            packageName = cleanPackage,
            versionName = "",
            versionCode = 0L,
            isInstalled = false,
            hasUpdate = false,
            latestStoreVersionName = storeVersionName,
            latestStoreVersionCode = storeVersionCode,
            resolvedPackageName = cleanPackage
        )
    }

    /**
     * Compares semantic version strings (e.g. "1.5.0" vs "1.4.1").
     * Returns true if [storeVer] is strictly newer than [installedVer].
     */
    fun isVersionNameNewer(storeVer: String, installedVer: String): Boolean {
        return try {
            val sParts = storeVer.trim().removePrefix("v").removePrefix("V").split(".", "-", "_")
                .mapNotNull { it.toIntOrNull() }
            val iParts = installedVer.trim().removePrefix("v").removePrefix("V").split(".", "-", "_")
                .mapNotNull { it.toIntOrNull() }

            if (sParts.isEmpty() || iParts.isEmpty()) return false

            val maxLen = maxOf(sParts.size, iParts.size)
            for (idx in 0 until maxLen) {
                val s = sParts.getOrElse(idx) { 0 }
                val i = iParts.getOrElse(idx) { 0 }
                if (s > i) return true
                if (s < i) return false
            }
            false
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Checks if this store app has permission to install unknown apps (Android 8.0+).
     */
    fun canRequestPackageInstalls(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.packageManager.canRequestPackageInstalls()
        } else {
            true
        }
    }

    /**
     * Intent to open the Android settings page to allow installing unknown apps.
     */
    fun getManageUnknownAppSourcesIntent(): Intent {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${context.packageName}")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        } else {
            Intent(Settings.ACTION_SECURITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        }
    }

    /**
     * Launches Android's native package installer intent for the downloaded APK file.
     */
    fun launchInstallIntent(apkFile: File, appId: String? = null): Result<Unit> {
        return try {
            if (!apkFile.exists()) {
                return Result.failure(IllegalStateException("APK file does not exist: ${apkFile.absolutePath}"))
            }

            // Record downloaded APK package mapping
            recordDownloadedApk(apkFile, appId)

            val contentUri: Uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                apkFile
            )

            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(contentUri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            context.startActivity(installIntent)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Launches an installed application by package name, checking candidates (such as .debug suffix).
     */
    fun launchApp(packageName: String): Boolean {
        val clean = packageName.trim()
        val candidates = linkedSetOf(clean, "$clean.debug", clean.removeSuffix(".debug")).filter { it.isNotBlank() }
        val pm = context.packageManager

        for (candidate in candidates) {
            try {
                val launchIntent = pm.getLaunchIntentForPackage(candidate)
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(launchIntent)
                    return true
                }
            } catch (e: Exception) {
                Log.w("ApkInstaller", "Error launching candidate: $candidate", e)
            }
        }

        // Try launcher category intent as fallback
        try {
            val mainIntent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
                `package` = clean
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(mainIntent)
            return true
        } catch (_: Exception) {}

        return false
    }
}
