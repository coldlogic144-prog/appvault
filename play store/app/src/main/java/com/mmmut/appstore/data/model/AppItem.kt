package com.mmmut.appstore.data.model

import com.google.firebase.Timestamp

data class AppItem(
    val id: String = "",
    val name: String = "",
    val packageName: String = "",
    val slug: String = "",
    val shortDescription: String = "",
    val description: String = "",
    val developer: String = "",
    val categoryId: String = "other",
    val iconUrl: String = "",
    val screenshots: List<String> = emptyList(),
    val featured: Boolean = false,
    val published: Boolean = true,
    val downloadCount: Long = 0L,
    val latestVersionId: String = "",
    val latestVersionName: String = "1.0.0",
    val latestVersionCode: Long = 1L,
    val minAndroidVersion: Int = 26,
    val apkSize: Long = 0L,
    val createdAt: Timestamp? = null,
    val updatedAt: Timestamp? = null
) {
    val formattedSize: String
        get() {
            if (apkSize <= 0) return "Unknown"
            val mb = apkSize.toDouble() / (1024 * 1024)
            return if (mb >= 1.0) {
                String.format("%.1f MB", mb)
            } else {
                val kb = apkSize.toDouble() / 1024
                String.format("%.1f KB", kb)
            }
        }

    val categoryDisplayName: String
        get() = Category.DEFAULT_CATEGORIES
            .find { it.id.equals(categoryId, ignoreCase = true) }
            ?.name ?: categoryId.replaceFirstChar { it.uppercase() }
}
