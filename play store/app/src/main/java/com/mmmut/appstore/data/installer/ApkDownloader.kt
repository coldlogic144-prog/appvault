package com.mmmut.appstore.data.installer

import android.content.Context
import com.mmmut.appstore.data.model.DownloadState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

class ApkDownloader(private val context: Context) {

    fun downloadApk(
        appId: String,
        versionCode: Long,
        apkUrl: String
    ): Flow<DownloadState> = flow {
        emit(DownloadState.Downloading(progress = 0, bytesDownloaded = 0, totalBytes = 0))

        if (apkUrl.isBlank()) {
            emit(DownloadState.Failed("Invalid APK download URL"))
            return@flow
        }

        try {
            val apkDir = File(context.cacheDir, "apks").apply {
                if (!exists()) mkdirs()
            }
            val destinationFile = File(apkDir, "${appId}_v${versionCode}.apk")

            // If file already exists and is valid, can reuse or re-download
            if (destinationFile.exists()) {
                destinationFile.delete()
            }

            val url = URL(apkUrl)
            val connection = (url.openConnection() as HttpURLConnection).apply {
                connectTimeout = 15000
                readTimeout = 30000
                instanceFollowRedirects = true
                requestMethod = "GET"
                connect()
            }

            if (connection.responseCode !in 200..299) {
                emit(DownloadState.Failed("Server returned HTTP error ${connection.responseCode}"))
                return@flow
            }

            val totalBytes = connection.contentLength.toLong()
            var bytesDownloaded = 0L

            val inputStream: InputStream = connection.inputStream
            val outputStream = FileOutputStream(destinationFile)

            val buffer = ByteArray(8 * 1024)
            var bytesRead: Int
            var lastEmittedProgress = 0

            while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                outputStream.write(buffer, 0, bytesRead)
                bytesDownloaded += bytesRead

                if (totalBytes > 0) {
                    val progress = ((bytesDownloaded * 100) / totalBytes).toInt()
                    if (progress > lastEmittedProgress) {
                        lastEmittedProgress = progress
                        emit(
                            DownloadState.Downloading(
                                progress = progress,
                                bytesDownloaded = bytesDownloaded,
                                totalBytes = totalBytes
                            )
                        )
                    }
                } else {
                    emit(
                        DownloadState.Downloading(
                            progress = -1,
                            bytesDownloaded = bytesDownloaded,
                            totalBytes = 0
                        )
                    )
                }
            }

            outputStream.flush()
            outputStream.close()
            inputStream.close()
            connection.disconnect()

            emit(DownloadState.Downloaded(destinationFile))
        } catch (e: Exception) {
            emit(DownloadState.Failed(e.localizedMessage ?: "Download failed unexpectedly"))
        }
    }.flowOn(Dispatchers.IO)
}
