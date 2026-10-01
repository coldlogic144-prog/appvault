package com.mmmut.appstore.data.model

sealed interface UploadState {
    data object Idle : UploadState
    data class Uploading(
        val progress: Int,
        val message: String = ""
    ) : UploadState
    data class Success(val downloadUrl: String) : UploadState
    data class Failed(val message: String) : UploadState
}
