package com.mmmut.appstore.ui.updates

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.mmmut.appstore.data.installer.ApkDownloader
import com.mmmut.appstore.data.installer.ApkInstaller
import com.mmmut.appstore.data.model.AppItem
import com.mmmut.appstore.data.model.DownloadState
import com.mmmut.appstore.data.model.InstalledAppInfo
import com.mmmut.appstore.data.repository.AppRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class UpdatableAppItem(
    val app: AppItem,
    val installedInfo: InstalledAppInfo,
    val downloadState: DownloadState = DownloadState.Idle
)

data class UpdatesUiState(
    val isScanning: Boolean = true,
    val updatableApps: List<UpdatableAppItem> = emptyList(),
    val upToDateApps: List<UpdatableAppItem> = emptyList(),
    val errorMessage: String? = null
)

class UpdatesViewModel(
    private val appRepository: AppRepository,
    private val apkInstaller: ApkInstaller,
    private val apkDownloader: ApkDownloader
) : ViewModel() {

    private val _uiState = MutableStateFlow(UpdatesUiState())
    val uiState: StateFlow<UpdatesUiState> = _uiState.asStateFlow()

    init {
        scanForUpdates()
    }

    fun scanForUpdates() {
        _uiState.update { it.copy(isScanning = true, errorMessage = null) }
        viewModelScope.launch {
            appRepository.getAllApps(null).collect { result ->
                result.fold(
                    onSuccess = { apps ->
                        val updatable = mutableListOf<UpdatableAppItem>()
                        val upToDate = mutableListOf<UpdatableAppItem>()

                        for (app in apps) {
                            if (app.packageName.isBlank()) continue
                            val installedInfo = apkInstaller.getInstalledAppInfo(
                                packageName = app.packageName,
                                storeVersionName = app.latestVersionName,
                                storeVersionCode = app.latestVersionCode
                            )

                            if (installedInfo.isInstalled) {
                                val item = UpdatableAppItem(app = app, installedInfo = installedInfo)
                                if (installedInfo.hasUpdate) {
                                    updatable.add(item)
                                } else {
                                    upToDate.add(item)
                                }
                            }
                        }

                        _uiState.update {
                            it.copy(
                                isScanning = false,
                                updatableApps = updatable,
                                upToDateApps = upToDate
                            )
                        }
                    },
                    onFailure = { error ->
                        _uiState.update {
                            it.copy(isScanning = false, errorMessage = error.localizedMessage)
                        }
                    }
                )
            }
        }
    }

    fun updateApp(item: UpdatableAppItem) {
        viewModelScope.launch {
            // Find latest version to get apkUrl
            appRepository.getAppVersions(item.app.id).collect { versionsResult ->
                val versions = versionsResult.getOrNull()
                val latest = versions?.firstOrNull { it.published }
                val apkUrl = latest?.apkUrl ?: ""

                if (apkUrl.isBlank()) {
                    updateDownloadState(item.app.id, DownloadState.Failed("No APK URL available for this version"))
                    return@collect
                }

                apkDownloader.downloadApk(
                    appId = item.app.id,
                    versionCode = item.app.latestVersionCode,
                    apkUrl = apkUrl
                ).collect { state ->
                    updateDownloadState(item.app.id, state)
                    if (state is DownloadState.Downloaded) {
                        // Increment download count
                        appRepository.incrementDownloadCount(item.app.id)
                        // Trigger installation
                        apkInstaller.launchInstallIntent(state.file)
                    }
                }
            }
        }
    }

    private fun updateDownloadState(appId: String, state: DownloadState) {
        _uiState.update { current ->
            current.copy(
                updatableApps = current.updatableApps.map {
                    if (it.app.id == appId) it.copy(downloadState = state) else it
                }
            )
        }
    }

    class Factory(
        private val appRepository: AppRepository,
        private val apkInstaller: ApkInstaller,
        private val apkDownloader: ApkDownloader
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return UpdatesViewModel(appRepository, apkInstaller, apkDownloader) as T
        }
    }
}
