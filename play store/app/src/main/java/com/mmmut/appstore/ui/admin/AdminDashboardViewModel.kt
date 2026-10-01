package com.mmmut.appstore.ui.admin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.mmmut.appstore.data.model.AdminStats
import com.mmmut.appstore.data.model.AppItem
import com.mmmut.appstore.data.repository.AppRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AdminDashboardUiState(
    val isLoading: Boolean = true,
    val stats: AdminStats = AdminStats(),
    val apps: List<AppItem> = emptyList(),
    val actionSuccessMessage: String? = null,
    val errorMessage: String? = null
)

class AdminDashboardViewModel(
    private val appRepository: AppRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AdminDashboardUiState())
    val uiState: StateFlow<AdminDashboardUiState> = _uiState.asStateFlow()

    init {
        loadDashboardData()
    }

    fun loadDashboardData() {
        _uiState.update { it.copy(isLoading = true, errorMessage = null) }
        viewModelScope.launch {
            // Load stats
            val statsResult = appRepository.getAdminStats()
            statsResult.onSuccess { stats ->
                _uiState.update { it.copy(stats = stats) }
            }

            // Load all apps including drafts
            appRepository.getAllAppsForAdmin().collect { result ->
                result.fold(
                    onSuccess = { apps ->
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                apps = apps
                            )
                        }
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

    fun toggleFeatured(app: AppItem) {
        viewModelScope.launch {
            val updated = app.copy(featured = !app.featured)
            val result = appRepository.updateApp(updated)
            result.fold(
                onSuccess = {
                    _uiState.update {
                        it.copy(actionSuccessMessage = if (updated.featured) "Marked as Featured" else "Unmarked as Featured")
                    }
                    loadStats()
                },
                onFailure = { err ->
                    _uiState.update { it.copy(errorMessage = err.localizedMessage) }
                }
            )
        }
    }

    fun togglePublished(app: AppItem) {
        viewModelScope.launch {
            val updated = app.copy(published = !app.published)
            val result = appRepository.updateApp(updated)
            result.fold(
                onSuccess = {
                    _uiState.update {
                        it.copy(actionSuccessMessage = if (updated.published) "App Published" else "App Unpublished (Draft)")
                    }
                    loadStats()
                },
                onFailure = { err ->
                    _uiState.update { it.copy(errorMessage = err.localizedMessage) }
                }
            )
        }
    }

    fun deleteApp(appId: String) {
        viewModelScope.launch {
            val result = appRepository.deleteApp(appId)
            result.fold(
                onSuccess = {
                    _uiState.update { it.copy(actionSuccessMessage = "App deleted successfully") }
                    loadStats()
                },
                onFailure = { err ->
                    _uiState.update { it.copy(errorMessage = err.localizedMessage) }
                }
            )
        }
    }

    private fun loadStats() {
        viewModelScope.launch {
            appRepository.getAdminStats().onSuccess { stats ->
                _uiState.update { it.copy(stats = stats) }
            }
        }
    }

    fun clearActionMessage() {
        _uiState.update { it.copy(actionSuccessMessage = null, errorMessage = null) }
    }

    class Factory(private val appRepository: AppRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return AdminDashboardViewModel(appRepository) as T
        }
    }
}
