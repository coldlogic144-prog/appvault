package com.mmmut.appstore.ui.settings

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseUser
import com.mmmut.appstore.data.repository.AuthRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File

enum class ThemeMode {
    SYSTEM, LIGHT, DARK
}

data class SettingsUiState(
    val currentUser: FirebaseUser? = null,
    val isAdmin: Boolean = false,
    val isCheckingAdmin: Boolean = false,
    val themeMode: ThemeMode = ThemeMode.SYSTEM,
    val cacheSizeBytes: Long = 0L,
    val cacheClearedMessage: String? = null
)

class SettingsViewModel(
    private val context: Context,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        observeAuthState()
        calculateCacheSize()
    }

    private fun observeAuthState() {
        viewModelScope.launch {
            authRepository.currentUser.collect { user ->
                _uiState.update { it.copy(currentUser = user) }
            }
        }
        viewModelScope.launch {
            authRepository.isAdmin.collect { admin ->
                _uiState.update { it.copy(isAdmin = admin) }
            }
        }
    }

    fun setThemeMode(mode: ThemeMode) {
        _uiState.update { it.copy(themeMode = mode) }
    }

    fun calculateCacheSize() {
        viewModelScope.launch(Dispatchers.IO) {
            val apkDir = File(context.cacheDir, "apks")
            val size = if (apkDir.exists()) {
                apkDir.walkTopDown().filter { it.isFile }.map { it.length() }.sum()
            } else {
                0L
            }
            _uiState.update { it.copy(cacheSizeBytes = size) }
        }
    }

    fun clearCache() {
        viewModelScope.launch(Dispatchers.IO) {
            val apkDir = File(context.cacheDir, "apks")
            if (apkDir.exists()) {
                apkDir.deleteRecursively()
                apkDir.mkdirs()
            }
            _uiState.update {
                it.copy(
                    cacheSizeBytes = 0L,
                    cacheClearedMessage = "Cache cleared successfully"
                )
            }
        }
    }

    fun signOut() {
        authRepository.signOut()
    }

    fun refreshAdminStatus() {
        viewModelScope.launch {
            _uiState.update { it.copy(isCheckingAdmin = true) }
            authRepository.refreshAdminStatus()
            _uiState.update { it.copy(isCheckingAdmin = false) }
        }
    }

    class Factory(
        private val context: Context,
        private val authRepository: AuthRepository
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return SettingsViewModel(context, authRepository) as T
        }
    }
}
