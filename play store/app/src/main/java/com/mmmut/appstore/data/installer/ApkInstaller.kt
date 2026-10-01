package com.mmmut.appstore.data.installer

import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.mmmut.appstore.data.model.InstalledAppInfo
import java.io.File

class ApkInstaller(private val context: Context) {

    /**
     * Inspects device packages to determine if [packageName] is installed,
     * its installed version code, and whether [storeVersionCode] is an update.
     */
    fun getInstalledAppInfo(
        packageName: String,
        storeVersionName: String = "",
        storeVersionCode: Long = 0L
    ): InstalledAppInfo {
        if (packageName.isBlank()) {
            return InstalledAppInfo(
                packageName = "",
                versionName = "",
                versionCode = 0L,
                isInstalled = false,
                hasUpdate = false,
                latestStoreVersionName = storeVersionName,
                latestStoreVersionCode = storeVersionCode
            )
        }

        return try {
            val packageInfo: PackageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.packageManager.getPackageInfo(
                    packageName,
                    PackageManager.PackageInfoFlags.of(0)
                )
            } else {
                @Suppress("DEPRECATION")
                context.packageManager.getPackageInfo(packageName, 0)
            }

            val installedVersionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageInfo.longVersionCode
            } else {
                @Suppress("DEPRECATION")
                packageInfo.versionCode.toLong()
            }

            val hasUpdate = storeVersionCode > installedVersionCode

            InstalledAppInfo(
                packageName = packageName,
                versionName = packageInfo.versionName ?: "",
                versionCode = installedVersionCode,
                isInstalled = true,
                hasUpdate = hasUpdate,
                latestStoreVersionName = storeVersionName,
                latestStoreVersionCode = storeVersionCode
            )
        } catch (_: PackageManager.NameNotFoundException) {
            InstalledAppInfo(
                packageName = packageName,
                versionName = "",
                versionCode = 0L,
                isInstalled = false,
                hasUpdate = false,
                latestStoreVersionName = storeVersionName,
                latestStoreVersionCode = storeVersionCode
            )
        } catch (e: Exception) {
            // Graceful fallback for any security or query restrictions
            InstalledAppInfo(
                packageName = packageName,
                versionName = "",
                versionCode = 0L,
                isInstalled = false,
                hasUpdate = false,
                latestStoreVersionName = storeVersionName,
                latestStoreVersionCode = storeVersionCode
            )
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
    fun launchInstallIntent(apkFile: File): Result<Unit> {
        return try {
            if (!apkFile.exists()) {
                return Result.failure(IllegalStateException("APK file does not exist: ${apkFile.absolutePath}"))
            }

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
     * Launches an installed application by package name.
     */
    fun launchApp(packageName: String): Boolean {
        return try {
            val launchIntent = context.packageManager.getLaunchIntentForPackage(packageName)
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(launchIntent)
                true
            } else {
                false
            }
        } catch (e: Exception) {
            false
        }
    }
}
