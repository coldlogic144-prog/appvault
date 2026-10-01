package com.mmmut.appstore.ui.details

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.mmmut.appstore.data.installer.ApkDownloader
import com.mmmut.appstore.data.installer.ApkInstaller
import com.mmmut.appstore.data.model.AppItem
import com.mmmut.appstore.data.model.AppVersion
import com.mmmut.appstore.data.model.DownloadState
import com.mmmut.appstore.data.model.InstalledAppInfo
import com.mmmut.appstore.data.repository.AppRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AppDetailsUiState(
    val isLoading: Boolean = true,
    val app: AppItem? = null,
    val latestVersion: AppVersion? = null,
    val allVersions: List<AppVersion> = emptyList(),
    val installedInfo: InstalledAppInfo? = null,
    val downloadState: DownloadState = DownloadState.Idle,
    val canRequestInstalls: Boolean = true,
    val errorMessage: String? = null
)

class AppDetailsViewModel(
    private val appId: String,
    private val appRepository: AppRepository,
    private val apkInstaller: ApkInstaller,
    private val apkDownloader: ApkDownloader
) : ViewModel() {

    private val _uiState = MutableStateFlow(AppDetailsUiState())
    val uiState: StateFlow<AppDetailsUiState> = _uiState.asStateFlow()

    private var downloadJob: Job? = null

    init {
        loadDetails()
    }

    fun loadDetails() {
        _uiState.update { it.copy(isLoading = true, errorMessage = null) }
        viewModelScope.launch {
            appRepository.getAppDetails(appId).collect { appResult ->
                val app = appResult.getOrNull()
                if (app == null) {
                    _uiState.update {
                        it.copy(isLoading = false, errorMessage = "Application not found")
                    }
                    return@collect
                }

                // Check installation status
                val installed = apkInstaller.getInstalledAppInfo(
                    packageName = app.packageName,
                    storeVersionName = app.latestVersionName,
                    storeVersionCode = app.latestVersionCode
                )

                // Load version changelog and APK info
                appRepository.getAppVersions(appId).collect { versionsResult ->
                    val versions = versionsResult.getOrDefault(emptyList())
                    val latest = versions.firstOrNull { it.published }
                    val canInstall = apkInstaller.canRequestPackageInstalls()

                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            app = app,
                            latestVersion = latest,
                            allVersions = versions,
                            installedInfo = installed,
                            canRequestInstalls = canInstall
                        )
                    }
                }
            }
        }
    }

    fun checkInstallPermission(): Boolean {
        val canInstall = apkInstaller.canRequestPackageInstalls()
        _uiState.update { it.copy(canRequestInstalls = canInstall) }
        return canInstall
    }

    fun installOrUpdateApp() {
        val app = _uiState.value.app ?: return
        val version = _uiState.value.latestVersion
        if (version == null) {
            _uiState.update {
                it.copy(downloadState = DownloadState.Failed("No published version exists for this application."))
            }
            return
        }
        if (version.apkUrl.isBlank()) {
            _uiState.update {
                it.copy(downloadState = DownloadState.Failed("APK link is unavailable."))
            }
            return
        }

        downloadJob?.cancel()
        downloadJob = viewModelScope.launch {
            apkDownloader.downloadApk(
                appId = app.id,
                versionCode = version.versionCode,
                apkUrl = version.apkUrl
            ).collect { state ->
                _uiState.update { it.copy(downloadState = state) }

                if (state is DownloadState.Downloaded) {
                    // Atomically increment download count in Firestore
                    appRepository.incrementDownloadCount(app.id)

                    // Trigger package installation intent
                    _uiState.update { it.copy(downloadState = DownloadState.Installing) }
                    val result = apkInstaller.launchInstallIntent(state.file)
                    result.onFailure { _ ->
                        _uiState.update {
                            it.copy(downloadState = DownloadState.Failed("Download completed, but Android could not start the installer."))
                        }
                    }
                }
            }
        }
    }

    fun cancelDownload() {
        downloadJob?.cancel()
        _uiState.update { it.copy(downloadState = DownloadState.Idle) }
    }

    fun openInstalledApp() {
        val app = _uiState.value.app ?: return
        apkInstaller.launchApp(app.packageName)
    }

    class Factory(
        private val appId: String,
        private val appRepository: AppRepository,
        private val apkInstaller: ApkInstaller,
        private val apkDownloader: ApkDownloader
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return AppDetailsViewModel(appId, appRepository, apkInstaller, apkDownloader) as T
        }
    }
}
