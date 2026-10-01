package com.mmmut.appstore.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.mmmut.appstore.data.model.AppItem
import com.mmmut.appstore.data.model.Category
import com.mmmut.appstore.data.repository.AppRepository
import com.mmmut.appstore.data.repository.NetworkMonitor
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
        viewModelScope.launch {
            combine(
                appRepository.getFeaturedApps(),
                appRepository.getRecentlyAddedApps(),
                appRepository.getRecentlyUpdatedApps(),
                appRepository.getAllApps(_uiState.value.selectedCategoryId)
            ) { featuredRes, recentRes, updatedRes, allRes ->
                val error = featuredRes.exceptionOrNull()
                    ?: recentRes.exceptionOrNull()
                    ?: updatedRes.exceptionOrNull()
                    ?: allRes.exceptionOrNull()

                HomeUiState(
                    isLoading = false,
                    featuredApps = featuredRes.getOrDefault(emptyList()),
                    recentlyAddedApps = recentRes.getOrDefault(emptyList()),
                    recentlyUpdatedApps = updatedRes.getOrDefault(emptyList()),
                    allApps = allRes.getOrDefault(emptyList()),
                    categories = Category.DEFAULT_CATEGORIES,
                    selectedCategoryId = _uiState.value.selectedCategoryId,
                    isOnline = _uiState.value.isOnline,
                    errorMessage = error?.localizedMessage
                )
            }.collect { newState ->
                _uiState.value = newState
            }
        }
    }

    fun selectCategory(categoryId: String) {
        _uiState.update { it.copy(selectedCategoryId = categoryId) }
        viewModelScope.launch {
            appRepository.getAllApps(categoryId).collect { result ->
                result.fold(
                    onSuccess = { apps ->
                        _uiState.update { it.copy(allApps = apps) }
                    },
                    onFailure = { error ->
                        _uiState.update { it.copy(errorMessage = error.localizedMessage) }
                    }
                )
            }
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
