package com.mmmut.appstore.data.model

import com.mmmut.appstore.data.model.AppItem

/**
 * Represents an application detected on the physical device,
 * with optional matching store metadata and update status.
 */
data class DeviceAppInfo(
    val packageName: String,
    val appName: String,
    val versionName: String,
    val versionCode: Long,
    val isSystemApp: Boolean = false,
    val firstInstallTime: Long = 0L,
    val lastUpdateTime: Long = 0L,
    val matchingStoreApp: AppItem? = null,
    val hasUpdate: Boolean = false,
    val latestStoreVersionName: String = "",
    val latestStoreVersionCode: Long = 0L
)
