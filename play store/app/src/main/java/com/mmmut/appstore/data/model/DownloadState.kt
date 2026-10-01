package com.mmmut.appstore.data.model

import java.io.File

sealed interface DownloadState {
    data object Idle : DownloadState
    data class Downloading(
        val progress: Int,
        val bytesDownloaded: Long,
        val totalBytes: Long
    ) : DownloadState
    data class Downloaded(val file: File) : DownloadState
    data object Installing : DownloadState
    data class Failed(val message: String) : DownloadState
}
