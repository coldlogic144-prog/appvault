package com.mmmut.appstore.data.model

data class Category(
    val id: String = "",
    val name: String = "",
    val iconName: String = "Apps"
) {
    companion object {
        val DEFAULT_CATEGORIES = listOf(
            Category("all", "All"),
            Category("education", "Education"),
            Category("productivity", "Productivity"),
            Category("utilities", "Utilities"),
            Category("tools", "Tools"),
            Category("entertainment", "Entertainment"),
            Category("other", "Other")
        )
    }
}
