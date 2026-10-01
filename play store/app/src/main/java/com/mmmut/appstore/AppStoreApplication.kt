package com.mmmut.appstore

import android.app.Application
import com.mmmut.appstore.di.AppContainer

class AppStoreApplication : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
