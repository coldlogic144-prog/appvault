package com.mmmut.appstore.di

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreSettings
import com.google.firebase.storage.FirebaseStorage
import com.mmmut.appstore.data.installer.ApkDownloader
import com.mmmut.appstore.data.installer.ApkInstaller
import com.mmmut.appstore.data.repository.AppRepository
import com.mmmut.appstore.data.repository.AuthRepository
import com.mmmut.appstore.data.repository.NetworkMonitor
import com.mmmut.appstore.data.repository.StorageRepository

class AppContainer(val context: Context) {

    init {
        // Initialize Firebase if not already initialized
        if (FirebaseApp.getApps(context).isEmpty()) {
            FirebaseApp.initializeApp(context)
        }
    }

    val firestore: FirebaseFirestore by lazy {
        FirebaseFirestore.getInstance().apply {
            // Enable offline persistence caching
            firestoreSettings = FirebaseFirestoreSettings.Builder()
                .setPersistenceEnabled(true)
                .setCacheSizeBytes(FirebaseFirestoreSettings.CACHE_SIZE_UNLIMITED)
                .build()
        }
    }

    val auth: FirebaseAuth by lazy {
        FirebaseAuth.getInstance()
    }

    val storage: FirebaseStorage by lazy {
        FirebaseStorage.getInstance()
    }

    val appRepository: AppRepository by lazy {
        AppRepository(firestore)
    }

    val authRepository: AuthRepository by lazy {
        AuthRepository(auth, firestore)
    }

    val storageRepository: StorageRepository by lazy {
        StorageRepository(storage)
    }

    val apkDownloader: ApkDownloader by lazy {
        ApkDownloader(context)
    }

    val apkInstaller: ApkInstaller by lazy {
        ApkInstaller(context)
    }

    val networkMonitor: NetworkMonitor by lazy {
        NetworkMonitor(context)
    }
}
