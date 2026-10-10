package com.mmmut.appstore.ui.updates

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.mmmut.appstore.data.installer.ApkDownloader
import com.mmmut.appstore.data.installer.ApkInstaller
import com.mmmut.appstore.data.model.AppItem
import com.mmmut.appstore.data.model.DeviceAppInfo
import com.mmmut.appstore.data.model.DownloadState
import com.mmmut.appstore.data.model.InstalledAppInfo
import com.mmmut.appstore.data.repository.AppRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class UpdatableAppItem(
    val app: AppItem,
    val installedInfo: InstalledAppInfo,
    val downloadState: DownloadState = DownloadState.Idle
)

enum class UpdatesFilter {
    ALL,
    UPDATES,
    STORE_APPS,
    DEVICE_APPS
}

data class UpdatesUiState(
    val isScanning: Boolean = true,
    val updatableApps: List<UpdatableAppItem> = emptyList(),
    val upToDateApps: List<UpdatableAppItem> = emptyList(),
    val deviceApps: List<DeviceAppInfo> = emptyList(),
    val totalDeviceAppsCount: Int = 0,
    val selectedFilter: UpdatesFilter = UpdatesFilter.ALL,
    val searchQuery: String = "",
    val isUpdatingAll: Boolean = false,
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

    private var scanJob: Job? = null

    fun scanForUpdates() {
        _uiState.update { it.copy(isScanning = true, errorMessage = null) }
        scanJob?.cancel()
        scanJob = viewModelScope.launch {
            // Step 1: Scan all applications installed on this physical device
            val scannedDeviceApps = withContext(Dispatchers.IO) {
                apkInstaller.getInstalledDeviceApps(includeSystemApps = false)
            }

            // Step 2: Query published apps catalogue and correlate with on-device apps
            appRepository.publishedAppsFlow.collect { result ->
                result.fold(
                    onSuccess = { storeApps ->
                        val updatable = mutableListOf<UpdatableAppItem>()
                        val upToDate = mutableListOf<UpdatableAppItem>()

                        for (app in storeApps) {
                            val installedInfo = apkInstaller.getInstalledAppInfo(
                                packageName = app.packageName,
                                storeVersionName = app.latestVersionName,
                                storeVersionCode = app.latestVersionCode,
                                appName = app.name,
                                appId = app.id
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

                        // Enrich scanned device apps with store metadata and update flags
                        val enrichedDeviceApps = scannedDeviceApps.map { devApp ->
                            val matchingStore = storeApps.firstOrNull { storeApp ->
                                storeApp.packageName.equals(devApp.packageName, ignoreCase = true) ||
                                (storeApp.packageName.isNotBlank() && devApp.packageName.contains(storeApp.packageName, ignoreCase = true)) ||
                                (storeApp.name.isNotBlank() && devApp.appName.equals(storeApp.name, ignoreCase = true))
                            }

                            if (matchingStore != null) {
                                val hasUpdate = when {
                                    matchingStore.latestVersionCode > 0L && devApp.versionCode > 0L ->
                                        matchingStore.latestVersionCode > devApp.versionCode
                                    matchingStore.latestVersionName.isNotBlank() && devApp.versionName.isNotBlank() ->
                                        apkInstaller.isVersionNameNewer(matchingStore.latestVersionName, devApp.versionName)
                                    else -> false
                                }
                                devApp.copy(
                                    matchingStoreApp = matchingStore,
                                    hasUpdate = hasUpdate,
                                    latestStoreVersionName = matchingStore.latestVersionName,
                                    latestStoreVersionCode = matchingStore.latestVersionCode
                                )
                            } else {
                                devApp
                            }
                        }

                        _uiState.update {
                            it.copy(
                                isScanning = false,
                                updatableApps = updatable,
                                upToDateApps = upToDate,
                                deviceApps = enrichedDeviceApps,
                                totalDeviceAppsCount = scannedDeviceApps.size,
                                errorMessage = null
                            )
                        }
                    },
                    onFailure = { error ->
                        // If network fails or store is unreachable, still present the detected device apps
                        _uiState.update {
                            it.copy(
                                isScanning = false,
                                deviceApps = scannedDeviceApps,
                                totalDeviceAppsCount = scannedDeviceApps.size,
                                errorMessage = error.localizedMessage
                            )
                        }
                    }
                )
            }
        }
    }

    fun setFilter(filter: UpdatesFilter) {
        _uiState.update { it.copy(selectedFilter = filter) }
    }

    fun setSearchQuery(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
    }

    fun launchApp(packageName: String): Boolean {
        return apkInstaller.launchApp(packageName)
    }

    fun updateAll() {
        val updatables = _uiState.value.updatableApps
        if (updatables.isEmpty()) return
        viewModelScope.launch {
            _uiState.update { it.copy(isUpdatingAll = true) }
            for (item in updatables) {
                updateApp(item)
            }
            _uiState.update { it.copy(isUpdatingAll = false) }
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
                    updateDownloadState(item.app.id, DownloadState.Failed("APK link is unavailable."))
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
                        val result = apkInstaller.launchInstallIntent(state.file, item.app.id)
                        result.onFailure {
                            updateDownloadState(item.app.id, DownloadState.Failed("Download completed, but Android could not start the installer."))
                        }
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
