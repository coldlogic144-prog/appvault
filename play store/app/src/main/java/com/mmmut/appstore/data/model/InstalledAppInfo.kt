package com.mmmut.appstore.data.model

data class InstalledAppInfo(
    val packageName: String,
    val versionName: String,
    val versionCode: Long,
    val isInstalled: Boolean,
    val hasUpdate: Boolean,
    val latestStoreVersionName: String = "",
    val latestStoreVersionCode: Long = 0L
)
