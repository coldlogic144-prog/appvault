package com.mmmut.appstore.data.repository

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.mmmut.appstore.data.model.AdminStats
import com.mmmut.appstore.data.model.AppItem
import com.mmmut.appstore.data.model.AppVersion
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class AppRepository(private val firestore: FirebaseFirestore) {

    private val appsCollection = firestore.collection("apps")

    /**
     * Flow of featured published applications.
     */
    fun getFeaturedApps(): Flow<Result<List<AppItem>>> = callbackFlow {
        val listener = appsCollection
            .whereEqualTo("published", true)
            .whereEqualTo("featured", true)
            .limit(10)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }
                val apps = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(AppItem::class.java)?.copy(id = doc.id)
                } ?: emptyList()
                trySend(Result.success(apps))
            }
        awaitClose { listener.remove() }
    }

    /**
     * Flow of recently added published applications.
     */
    fun getRecentlyAddedApps(): Flow<Result<List<AppItem>>> = callbackFlow {
        val listener = appsCollection
            .whereEqualTo("published", true)
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .limit(10)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }
                val apps = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(AppItem::class.java)?.copy(id = doc.id)
                } ?: emptyList()
                trySend(Result.success(apps))
            }
        awaitClose { listener.remove() }
    }

    /**
     * Flow of recently updated published applications.
     */
    fun getRecentlyUpdatedApps(): Flow<Result<List<AppItem>>> = callbackFlow {
        val listener = appsCollection
            .whereEqualTo("published", true)
            .orderBy("updatedAt", Query.Direction.DESCENDING)
            .limit(10)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }
                val apps = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(AppItem::class.java)?.copy(id = doc.id)
                } ?: emptyList()
                trySend(Result.success(apps))
            }
        awaitClose { listener.remove() }
    }

    /**
     * Flow of all published applications, optionally filtered by category.
     */
    fun getAllApps(categoryId: String? = null): Flow<Result<List<AppItem>>> = callbackFlow {
        var query: Query = appsCollection.whereEqualTo("published", true)
        if (!categoryId.isNullOrBlank() && !categoryId.equals("all", ignoreCase = true)) {
            query = query.whereEqualTo("categoryId", categoryId.lowercase())
        }

        val listener = query.addSnapshotListener { snapshot, error ->
            if (error != null) {
                trySend(Result.failure(error))
                return@addSnapshotListener
            }
            val apps = snapshot?.documents?.mapNotNull { doc ->
                doc.toObject(AppItem::class.java)?.copy(id = doc.id)
            } ?: emptyList()
            trySend(Result.success(apps))
        }
        awaitClose { listener.remove() }
    }

    /**
     * Observes a single application's details in real-time.
     */
    fun getAppDetails(appId: String): Flow<Result<AppItem?>> = callbackFlow {
        val listener = appsCollection.document(appId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }
                val app = snapshot?.toObject(AppItem::class.java)?.copy(id = snapshot.id)
                trySend(Result.success(app))
            }
        awaitClose { listener.remove() }
    }

    /**
     * Observes versions for a specific app.
     */
    fun getAppVersions(appId: String, includeDrafts: Boolean = false): Flow<Result<List<AppVersion>>> = callbackFlow {
        var query: Query = appsCollection.document(appId).collection("versions")
        if (!includeDrafts) {
            query = query.whereEqualTo("published", true)
        }
        query = query.orderBy("versionCode", Query.Direction.DESCENDING)

        val listener = query.addSnapshotListener { snapshot, error ->
            if (error != null) {
                trySend(Result.failure(error))
                return@addSnapshotListener
            }
            val versions = snapshot?.documents?.mapNotNull { doc ->
                doc.toObject(AppVersion::class.java)?.copy(id = doc.id)
            } ?: emptyList()
            trySend(Result.success(versions))
        }
        awaitClose { listener.remove() }
    }

    /**
     * Atomically increments the download counter for an application.
     */
    suspend fun incrementDownloadCount(appId: String): Result<Unit> {
        return try {
            appsCollection.document(appId)
                .update("downloadCount", FieldValue.increment(1))
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // =========================================================================
    // ADMIN FUNCTIONS
    // =========================================================================

    /**
     * Flow of all applications (published and drafts) for Admin dashboard.
     */
    fun getAllAppsForAdmin(): Flow<Result<List<AppItem>>> = callbackFlow {
        val listener = appsCollection
            .orderBy("updatedAt", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }
                val apps = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(AppItem::class.java)?.copy(id = doc.id)
                } ?: emptyList()
                trySend(Result.success(apps))
            }
        awaitClose { listener.remove() }
    }

    suspend fun getAdminStats(): Result<AdminStats> {
        return try {
            val snapshot = appsCollection.get().await()
            var total = 0
            var published = 0
            var drafts = 0
            var totalDownloads = 0L

            for (doc in snapshot.documents) {
                total++
                val isPub = doc.getBoolean("published") ?: false
                if (isPub) published++ else drafts++
                val downloads = doc.getLong("downloadCount") ?: 0L
                totalDownloads += downloads
            }

            Result.success(
                AdminStats(
                    totalApps = total,
                    publishedApps = published,
                    draftApps = drafts,
                    totalDownloads = totalDownloads
                )
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createApp(app: AppItem): Result<String> {
        return try {
            val docRef = if (app.id.isNotBlank()) appsCollection.document(app.id) else appsCollection.document()
            val now = Timestamp.now()
            val finalApp = app.copy(
                id = docRef.id,
                createdAt = app.createdAt ?: now,
                updatedAt = now
            )
            docRef.set(finalApp).await()
            Result.success(docRef.id)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateApp(app: AppItem): Result<Unit> {
        return try {
            val now = Timestamp.now()
            val finalApp = app.copy(updatedAt = now)
            appsCollection.document(app.id).set(finalApp).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteApp(appId: String): Result<Unit> {
        return try {
            // Delete versions subcollection documents first
            val versionsSnapshot = appsCollection.document(appId).collection("versions").get().await()
            for (versionDoc in versionsSnapshot.documents) {
                versionDoc.reference.delete().await()
            }
            // Delete parent app document
            appsCollection.document(appId).delete().await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createVersion(appId: String, version: AppVersion): Result<String> {
        return try {
            val versionsRef = appsCollection.document(appId).collection("versions")
            val docRef = if (version.id.isNotBlank()) versionsRef.document(version.id) else versionsRef.document()
            val now = Timestamp.now()
            val finalVersion = version.copy(
                id = docRef.id,
                appId = appId,
                createdAt = version.createdAt ?: now
            )
            docRef.set(finalVersion).await()

            // Update parent app's latest version fields and updatedAt timestamp
            if (version.published) {
                appsCollection.document(appId).update(
                    mapOf(
                        "latestVersionId" to docRef.id,
                        "latestVersionName" to version.versionName,
                        "latestVersionCode" to version.versionCode,
                        "minAndroidVersion" to version.minAndroidVersion,
                        "apkSize" to version.apkSize,
                        "updatedAt" to now
                    )
                ).await()
            }

            Result.success(docRef.id)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun toggleVersionPublish(appId: String, versionId: String, publish: Boolean): Result<Unit> {
        return try {
            appsCollection.document(appId)
                .collection("versions")
                .document(versionId)
                .update("published", publish)
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteVersion(appId: String, versionId: String): Result<Unit> {
        return try {
            appsCollection.document(appId)
                .collection("versions")
                .document(versionId)
                .delete()
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
