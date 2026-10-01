package com.mmmut.appstore.ui.apps

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.mmmut.appstore.data.model.AppItem
import com.mmmut.appstore.data.model.Category
import com.mmmut.appstore.data.repository.AppRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class AppSortOption(val displayName: String) {
    NEWEST("Newest"),
    ALPHABETICAL("A to Z"),
    DOWNLOADS("Most Downloaded")
}

data class AppsUiState(
    val isLoading: Boolean = true,
    val apps: List<AppItem> = emptyList(),
    val categories: List<Category> = Category.DEFAULT_CATEGORIES,
    val selectedCategoryId: String = "all",
    val sortOption: AppSortOption = AppSortOption.NEWEST,
    val errorMessage: String? = null
)

class AppsViewModel(
    private val appRepository: AppRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AppsUiState())
    val uiState: StateFlow<AppsUiState> = _uiState.asStateFlow()

    private var rawApps: List<AppItem> = emptyList()

    init {
        loadApps()
    }

    fun loadApps(categoryId: String = _uiState.value.selectedCategoryId) {
        _uiState.update { it.copy(isLoading = true, selectedCategoryId = categoryId, errorMessage = null) }
        viewModelScope.launch {
            appRepository.getAllApps(categoryId).collect { result ->
                result.fold(
                    onSuccess = { list ->
                        rawApps = list
                        applySortingAndEmit()
                    },
                    onFailure = { error ->
                        _uiState.update {
                            it.copy(isLoading = false, errorMessage = error.localizedMessage)
                        }
                    }
                )
            }
        }
    }

    fun selectCategory(categoryId: String) {
        loadApps(categoryId)
    }

    fun setSortOption(option: AppSortOption) {
        _uiState.update { it.copy(sortOption = option) }
        applySortingAndEmit()
    }

    private fun applySortingAndEmit() {
        val sorted = when (_uiState.value.sortOption) {
            AppSortOption.NEWEST -> rawApps.sortedByDescending { it.createdAt?.seconds ?: 0L }
            AppSortOption.ALPHABETICAL -> rawApps.sortedBy { it.name.lowercase() }
            AppSortOption.DOWNLOADS -> rawApps.sortedByDescending { it.downloadCount }
        }
        _uiState.update { it.copy(isLoading = false, apps = sorted) }
    }

    class Factory(private val appRepository: AppRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return AppsViewModel(appRepository) as T
        }
    }
}
