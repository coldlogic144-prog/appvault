package com.mmmut.appstore.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.mmmut.appstore.data.model.AppItem
import com.mmmut.appstore.data.model.Category
import com.mmmut.appstore.data.repository.AppRepository
import com.mmmut.appstore.data.repository.NetworkMonitor
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class HomeUiState(
    val isLoading: Boolean = true,
    val featuredApps: List<AppItem> = emptyList(),
    val recentlyAddedApps: List<AppItem> = emptyList(),
    val recentlyUpdatedApps: List<AppItem> = emptyList(),
    val allApps: List<AppItem> = emptyList(),
    val categories: List<Category> = Category.DEFAULT_CATEGORIES,
    val selectedCategoryId: String = "all",
    val isOnline: Boolean = true,
    val errorMessage: String? = null
)

class HomeViewModel(
    private val appRepository: AppRepository,
    private val networkMonitor: NetworkMonitor
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    private var rawPublishedApps: List<AppItem> = emptyList()
    private var dataLoadJob: Job? = null

    init {
        observeNetwork()
        loadData()
    }

    private fun observeNetwork() {
        viewModelScope.launch {
            networkMonitor.isOnline.collect { online ->
                _uiState.update { it.copy(isOnline = online) }
            }
        }
    }

    fun loadData() {
        _uiState.update { it.copy(isLoading = true, errorMessage = null) }
        dataLoadJob?.cancel()
        dataLoadJob = viewModelScope.launch {
            appRepository.publishedAppsFlow.collect { result ->
                result.fold(
                    onSuccess = { apps ->
                        rawPublishedApps = apps
                        updateUiStateWithApps(apps, _uiState.value.selectedCategoryId)
                    },
                    onFailure = { error ->
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                errorMessage = error.localizedMessage
                            )
                        }
                    }
                )
            }
        }
    }

    fun selectCategory(categoryId: String) {
        _uiState.update { it.copy(selectedCategoryId = categoryId) }
        updateUiStateWithApps(rawPublishedApps, categoryId)
    }

    private fun updateUiStateWithApps(apps: List<AppItem>, categoryId: String) {
        val featured = apps.filter { it.featured }.take(10)
        val recent = apps.sortedByDescending { it.createdAt?.seconds ?: 0L }.take(10)
        val updated = apps.sortedByDescending { it.updatedAt?.seconds ?: 0L }.take(10)
        val filtered = if (categoryId.isBlank() || categoryId.equals("all", ignoreCase = true)) {
            apps
        } else {
            apps.filter { it.categoryId.equals(categoryId, ignoreCase = true) }
        }

        _uiState.update {
            it.copy(
                isLoading = false,
                featuredApps = featured,
                recentlyAddedApps = recent,
                recentlyUpdatedApps = updated,
                allApps = filtered,
                selectedCategoryId = categoryId,
                errorMessage = null
            )
        }
    }

    class Factory(
        private val appRepository: AppRepository,
        private val networkMonitor: NetworkMonitor
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return HomeViewModel(appRepository, networkMonitor) as T
        }
    }
}
