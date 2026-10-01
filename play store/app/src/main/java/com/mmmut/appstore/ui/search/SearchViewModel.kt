package com.mmmut.appstore.ui.search

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

data class SearchUiState(
    val query: String = "",
    val selectedCategoryId: String = "all",
    val isLoading: Boolean = false,
    val searchResults: List<AppItem> = emptyList(),
    val categories: List<Category> = Category.DEFAULT_CATEGORIES,
    val totalAvailableApps: Int = 0,
    val hasSearched: Boolean = false,
    val errorMessage: String? = null
)

class SearchViewModel(
    private val appRepository: AppRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()

    private var allPublishedApps: List<AppItem> = emptyList()

    init {
        loadAllApps()
    }

    private fun loadAllApps() {
        _uiState.update { it.copy(isLoading = true) }
        viewModelScope.launch {
            appRepository.getAllApps(null).collect { result ->
                result.fold(
                    onSuccess = { list ->
                        allPublishedApps = list
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                totalAvailableApps = list.size
                            )
                        }
                        performFilter(_uiState.value.query, _uiState.value.selectedCategoryId)
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

    fun onQueryChanged(newQuery: String) {
        _uiState.update { it.copy(query = newQuery, hasSearched = newQuery.isNotBlank()) }
        performFilter(newQuery, _uiState.value.selectedCategoryId)
    }

    fun selectCategory(categoryId: String) {
        _uiState.update { it.copy(selectedCategoryId = categoryId) }
        performFilter(_uiState.value.query, categoryId)
    }

    fun clearQuery() {
        onQueryChanged("")
    }

    private fun performFilter(query: String, categoryId: String) {
        val q = query.trim().lowercase()
        val cat = categoryId.lowercase()

        val filtered = allPublishedApps.filter { app ->
            val matchesCategory = cat == "all" || app.categoryId.lowercase() == cat
            val matchesQuery = if (q.isBlank()) {
                true
            } else {
                app.name.lowercase().contains(q) ||
                        app.shortDescription.lowercase().contains(q) ||
                        app.description.lowercase().contains(q) ||
                        app.developer.lowercase().contains(q) ||
                        app.categoryDisplayName.lowercase().contains(q) ||
                        app.packageName.lowercase().contains(q)
            }
            matchesCategory && matchesQuery
        }

        _uiState.update { it.copy(searchResults = filtered) }
    }

    class Factory(private val appRepository: AppRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return SearchViewModel(appRepository) as T
        }
    }
}
