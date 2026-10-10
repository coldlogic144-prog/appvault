package com.mmmut.appstore.data.repository

import android.content.Context
import android.net.Uri
import com.google.firebase.storage.FirebaseStorage
import com.google.firebase.storage.StorageMetadata
import com.google.firebase.storage.StorageReference
import com.mmmut.appstore.data.model.UploadState
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class StorageRepository(
    private val context: Context,
    private val storage: FirebaseStorage
) {

    private fun getMimeTypeAndExtension(uri: Uri): Pair<String, String> {
        val type = context.contentResolver.getType(uri) ?: "image/png"
        val ext = when (type.lowercase()) {
            "image/jpeg", "image/jpg" -> "jpg"
            "image/webp" -> "webp"
            "image/gif" -> "gif"
            "image/svg+xml" -> "svg"
            else -> "png"
        }
        return Pair(type, ext)
    }

    /**
     * Uploads an application icon image.
     */
    fun uploadAppIcon(appId: String, uri: Uri): Flow<UploadState> = callbackFlow {
        trySend(UploadState.Uploading(0, "Preparing icon upload..."))
        val (mimeType, ext) = getMimeTypeAndExtension(uri)
        val filename = "icon_${System.currentTimeMillis()}_${(1000..9999).random()}.$ext"
        val ref: StorageReference = storage.reference.child("apps/$appId/icon/$filename")
        val metadata = StorageMetadata.Builder()
            .setContentType(mimeType)
            .build()

        val uploadTask = ref.putFile(uri, metadata)

        uploadTask.addOnProgressListener { snapshot ->
            val totalBytes = snapshot.totalByteCount
            if (totalBytes > 0) {
                val progress = ((snapshot.bytesTransferred * 100) / totalBytes).toInt()
                trySend(UploadState.Uploading(progress, "Uploading icon: $progress%"))
            }
        }.addOnSuccessListener {
            ref.downloadUrl.addOnSuccessListener { downloadUri ->
                trySend(UploadState.Success(downloadUri.toString()))
                close()
            }.addOnFailureListener { e ->
                trySend(UploadState.Failed("Failed to get icon URL: ${e.localizedMessage ?: "Unknown error"}"))
                close()
            }
        }.addOnFailureListener { e ->
            trySend(UploadState.Failed("Icon upload failed: ${e.localizedMessage ?: "Storage error. Ensure Storage is enabled."}"))
            close()
        }

        awaitClose {
            if (uploadTask.isInProgress) {
                uploadTask.cancel()
            }
        }
    }

    /**
     * Uploads an application screenshot image.
     */
    fun uploadScreenshot(appId: String, uri: Uri): Flow<UploadState> = callbackFlow {
        trySend(UploadState.Uploading(0, "Preparing screenshot upload..."))
        val (mimeType, ext) = getMimeTypeAndExtension(uri)
        val filename = "screenshot_${System.currentTimeMillis()}_${(1000..9999).random()}.$ext"
        val ref: StorageReference = storage.reference.child("apps/$appId/screenshots/$filename")
        val metadata = StorageMetadata.Builder()
            .setContentType(mimeType)
            .build()

        val uploadTask = ref.putFile(uri, metadata)

        uploadTask.addOnProgressListener { snapshot ->
            val totalBytes = snapshot.totalByteCount
            if (totalBytes > 0) {
                val progress = ((snapshot.bytesTransferred * 100) / totalBytes).toInt()
                trySend(UploadState.Uploading(progress, "Uploading screenshot: $progress%"))
            }
        }.addOnSuccessListener {
            ref.downloadUrl.addOnSuccessListener { downloadUri ->
                trySend(UploadState.Success(downloadUri.toString()))
                close()
            }.addOnFailureListener { e ->
                trySend(UploadState.Failed("Failed to get screenshot URL: ${e.localizedMessage ?: "Unknown error"}"))
                close()
            }
        }.addOnFailureListener { e ->
            trySend(UploadState.Failed("Screenshot upload failed: ${e.localizedMessage ?: "Storage error. Ensure Storage is enabled."}"))
            close()
        }

        awaitClose {
            if (uploadTask.isInProgress) {
                uploadTask.cancel()
            }
        }
    }


    suspend fun deleteFile(storagePathOrUrl: String): Result<Unit> {
        return try {
            val ref = if (storagePathOrUrl.startsWith("gs://") || storagePathOrUrl.startsWith("http")) {
                storage.getReferenceFromUrl(storagePathOrUrl)
            } else {
                storage.reference.child(storagePathOrUrl)
            }
            ref.delete().await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
