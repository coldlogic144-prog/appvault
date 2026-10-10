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
import java.net.ConnectException
import java.net.HttpURLConnection
import java.net.MalformedURLException
import java.net.SocketTimeoutException
import java.net.URL
import java.net.UnknownHostException

class ApkDownloader(private val context: Context) {

    fun downloadApk(
        appId: String,
        versionCode: Long,
        apkUrl: String
    ): Flow<DownloadState> = flow {
        emit(DownloadState.Downloading(progress = 0, bytesDownloaded = 0, totalBytes = 0))

        val trimmedUrl = apkUrl.trim()
        if (trimmedUrl.isBlank() || (!trimmedUrl.startsWith("http://", ignoreCase = true) && !trimmedUrl.startsWith("https://", ignoreCase = true))) {
            emit(DownloadState.Failed("Invalid APK download URL."))
            return@flow
        }

        var tempFile: File? = null
        try {
            val apkDir = File(context.cacheDir, "apks").apply {
                if (!exists()) mkdirs()
            }
            val destinationFile = File(apkDir, "${appId}_v${versionCode}.apk")
            val partFile = File(apkDir, "${appId}_v${versionCode}.apk.tmp")
            tempFile = partFile

            var currentUrl = trimmedUrl
            var connection: HttpURLConnection? = null
            var redirects = 0
            val maxRedirects = 8

            // Loop to handle redirects, specifically from github.com to objects.githubusercontent.com
            while (true) {
                val targetUrl = try {
                    URL(currentUrl)
                } catch (e: MalformedURLException) {
                    emit(DownloadState.Failed("Invalid APK download URL."))
                    return@flow
                }

                connection = (targetUrl.openConnection() as HttpURLConnection).apply {
                    connectTimeout = 15000
                    readTimeout = 40000
                    instanceFollowRedirects = true
                    requestMethod = "GET"
                    setRequestProperty("User-Agent", "AppVault-Store/1.0.0 (Android; GitHub-Releases-Downloader)")
                    setRequestProperty("Accept", "application/vnd.android.package-archive, application/octet-stream, */*")
                    connect()
                }

                val responseCode = connection.responseCode
                if (responseCode in listOf(
                        HttpURLConnection.HTTP_MOVED_PERM,
                        HttpURLConnection.HTTP_MOVED_TEMP,
                        HttpURLConnection.HTTP_SEE_OTHER,
                        307, // Temporary Redirect
                        308  // Permanent Redirect
                    )
                ) {
                    val location = connection.getHeaderField("Location")
                    connection.disconnect()
                    if (location != null && redirects < maxRedirects) {
                        redirects++
                        currentUrl = location
                        continue
                    } else {
                        emit(DownloadState.Failed("APK link is unavailable."))
                        return@flow
                    }
                }

                if (responseCode !in 200..299) {
                    connection.disconnect()
                    emit(DownloadState.Failed("APK link is unavailable."))
                    return@flow
                }

                break
            }

            val finalConnection = connection ?: run {
                emit(DownloadState.Failed("APK link is unavailable."))
                return@flow
            }

            val totalBytes = finalConnection.contentLength.toLong()

            // Avoid unnecessary duplicate download if cached file exists with identical size
            if (destinationFile.exists() && totalBytes > 0 && destinationFile.length() == totalBytes) {
                finalConnection.disconnect()
                emit(DownloadState.Downloaded(destinationFile))
                return@flow
            }

            if (partFile.exists()) {
                partFile.delete()
            }

            var bytesDownloaded = 0L
            val inputStream: InputStream = finalConnection.inputStream
            val outputStream = FileOutputStream(partFile)

            // Optimized 32KB streaming buffer: reduces system call and I/O overhead on slow eMMC storage
            val buffer = ByteArray(32 * 1024)
            var bytesRead: Int
            var lastEmittedProgress = 0

            try {
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
            } finally {
                try { outputStream.close() } catch (_: Exception) {}
                try { inputStream.close() } catch (_: Exception) {}
                finalConnection.disconnect()
            }

            if (!partFile.exists() || partFile.length() == 0L || (totalBytes > 0 && partFile.length() != totalBytes)) {
                if (partFile.exists()) partFile.delete()
                emit(DownloadState.Failed("APK download was incomplete or corrupted."))
                return@flow
            }

            // Atomically promote temporary file to final destination file
            if (destinationFile.exists()) {
                destinationFile.delete()
            }

            val renameSuccess = partFile.renameTo(destinationFile)
            val finalFile = if (renameSuccess) destinationFile else partFile

            emit(DownloadState.Downloaded(finalFile))
        } catch (e: UnknownHostException) {
            tempFile?.let { if (it.exists()) it.delete() }
            emit(DownloadState.Failed("Unable to download APK. Check your internet connection."))
        } catch (e: SocketTimeoutException) {
            tempFile?.let { if (it.exists()) it.delete() }
            emit(DownloadState.Failed("Unable to download APK. Check your internet connection."))
        } catch (e: ConnectException) {
            tempFile?.let { if (it.exists()) it.delete() }
            emit(DownloadState.Failed("Unable to download APK. Check your internet connection."))
        } catch (e: MalformedURLException) {
            tempFile?.let { if (it.exists()) it.delete() }
            emit(DownloadState.Failed("Invalid APK download URL."))
        } catch (e: Exception) {
            tempFile?.let { if (it.exists()) it.delete() }
            val message = e.localizedMessage?.lowercase() ?: ""
            if (message.contains("unable to resolve host") || message.contains("network") || message.contains("connection")) {
                emit(DownloadState.Failed("Unable to download APK. Check your internet connection."))
            } else {
                emit(DownloadState.Failed(e.localizedMessage ?: "Unable to download APK. Check your internet connection."))
            }
        }
    }.flowOn(Dispatchers.IO)
}
