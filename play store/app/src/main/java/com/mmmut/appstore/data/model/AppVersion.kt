package com.mmmut.appstore.data.model

import com.google.firebase.Timestamp

data class AppVersion(
    val id: String = "",
    val appId: String = "",
    val versionName: String = "",
    val versionCode: Long = 1L,
    val releaseTag: String = "",
    val apkUrl: String = "",
    val releaseNotes: String = "",
    val changelog: String = "",
    val apkStoragePath: String = "",
    val apkSize: Long = 0L,
    val minAndroidVersion: Int = 26,
    val published: Boolean = true,
    val createdAt: Timestamp? = null
) {
    val displayNotes: String
        get() = releaseNotes.ifBlank { changelog }

    val formattedSize: String
        get() {
            if (apkSize <= 0) return "Unknown size"
            val mb = apkSize.toDouble() / (1024 * 1024)
            return if (mb >= 1.0) {
                String.format("%.1f MB", mb)
            } else {
                val kb = apkSize.toDouble() / 1024
                String.format("%.1f KB", kb)
            }
        }

    val minAndroidVersionText: String
        get() = when (minAndroidVersion) {
            21 -> "Android 5.0+"
            23 -> "Android 6.0+"
            24 -> "Android 7.0+"
            26 -> "Android 8.0+"
            28 -> "Android 9.0+"
            29 -> "Android 10+"
            30 -> "Android 11+"
            31 -> "Android 12+"
            33 -> "Android 13+"
            34 -> "Android 14+"
            else -> "Android API $minAndroidVersion+"
        }
}
