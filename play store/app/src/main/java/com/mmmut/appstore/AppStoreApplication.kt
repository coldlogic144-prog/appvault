package com.mmmut.appstore

import android.app.ActivityManager
import android.app.Application
import android.content.Context
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import coil.request.CachePolicy
import com.mmmut.appstore.di.AppContainer

class AppStoreApplication : Application(), ImageLoaderFactory {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }

    override fun newImageLoader(): ImageLoader {
        val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
        val isLowRamDevice = activityManager?.isLowRamDevice == true

        // On low-RAM devices (<= 1-2 GB), restrict memory cache to 15%, otherwise 25%
        val memCachePercent = if (isLowRamDevice) 0.15 else 0.25

        return ImageLoader.Builder(this)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(memCachePercent)
                    .strongReferencesEnabled(true)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("image_cache"))
                    .maxSizeBytes(50L * 1024 * 1024) // 50 MB bounded disk cache
                    .build()
            }
            // Use RGB_565 on low-RAM devices to halve bitmap memory usage (2 bytes per pixel vs 4 bytes)
            .allowRgb565(isLowRamDevice)
            // Cache Google Drive and CDN media locally even if headers are conservative
            .respectCacheHeaders(false)
            .diskCachePolicy(CachePolicy.ENABLED)
            .memoryCachePolicy(CachePolicy.ENABLED)
            .crossfade(150)
            .build()
    }
}

