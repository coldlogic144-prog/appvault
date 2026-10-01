# AppVault Native Android App Store

A real native Android application built with **Kotlin**, **Jetpack Compose**, **Material 3**, and **Firebase** that functions as a private, custom Play Store for distributing native Android APKs.

---

## 1. Architecture Overview

Built following modern Android architectural standards:

- **UI Layer**: Jetpack Compose, Material 3, Navigation Compose, Coroutines StateFlow.
- **State Management**: MVVM Pattern with `ViewModel` and `StateFlow`.
- **Domain & Data Layer**: Repository Pattern (`AppRepository`, `AuthRepository`, `StorageRepository`, `NetworkMonitor`).
- **Downloader & Installer**: Custom `ApkDownloader` (with buffered percentage progress tracking) and `ApkInstaller` using Android's `FileProvider` and `ACTION_VIEW` package installer intent.
- **Backend**: Firebase Authentication (Email/Password + Custom Claims), Cloud Firestore (Offline persistence enabled), and Firebase Storage.

```
app/
 ├── data/
 │   ├── model/
 │   │   ├── AppItem.kt              # App catalogue model
 │   │   ├── AppVersion.kt          # Multi-version model
 │   │   ├── Category.kt            # Categories metadata
 │   │   ├── DownloadState.kt       # Live download state machine
 │   │   ├── UploadState.kt         # Live upload state machine
 │   │   ├── InstalledAppInfo.kt    # Device package status
 │   │   └── AdminStats.kt          # Metric counters
 │   ├── repository/
 │   │   ├── AppRepository.kt       # Firestore CRUD & atomic counters
 │   │   ├── AuthRepository.kt      # Firebase Auth & admin validation
 │   │   ├── StorageRepository.kt   # Firebase Storage APK & image uploads
 │   │   └── NetworkMonitor.kt      # ConnectivityManager state stream
 │   └── installer/
 │       ├── ApkDownloader.kt       # Resilient buffered downloader
 │       └── ApkInstaller.kt        # Android PackageInstaller & FileProvider
 ├── di/
 │   └── AppContainer.kt            # Central Service Locator / Container
 ├── navigation/
 │   ├── NavRoutes.kt               # Type-safe navigation routes
 │   └── AppNavHost.kt              # Top-level NavHost with bottom bar
 ├── ui/
 │   ├── theme/                     # Material 3 tokens, dynamic colors, dark/light
 │   ├── components/                # Reusable Compose components
 │   ├── home/                      # Featured, Recent, Categories, Catalogue
 │   ├── apps/                      # Categorized list with sorting (A-Z, New, Downloads)
 │   ├── search/                    # Instant multi-field metadata search
 │   ├── updates/                   # Checks installed apps & one-tap update
 │   ├── details/                   # App info, screenshots, changelog, download/install
 │   ├── settings/                  # Theme toggle, cache cleaner, admin entry
 │   └── admin/                     # Secure admin login, dashboard, app & version management
 ├── AppStoreApplication.kt
 └── MainActivity.kt
```

---

## 2. Firebase Backend Configuration

### A. Firestore Structure
- **`apps/{appId}`**
  - `id`: String
  - `name`: String (e.g., "MMMUT ERP")
  - `packageName`: String (e.g., "com.mmmut.erp")
  - `slug`: String
  - `shortDescription`: String
  - `description`: String
  - `developer`: String
  - `categoryId`: String (e.g., "education", "productivity", "utilities", "tools")
  - `iconUrl`: String
  - `screenshots`: List<String>
  - `featured`: Boolean
  - `published`: Boolean
  - `downloadCount`: Long
  - `latestVersionId`: String
  - `latestVersionName`: String
  - `latestVersionCode`: Long
  - `minAndroidVersion`: Int (e.g., 26 for Android 8.0)
  - `apkSize`: Long (bytes)
  - `createdAt`: Timestamp
  - `updatedAt`: Timestamp

- **`apps/{appId}/versions/{versionId}`**
  - `id`: String
  - `appId`: String
  - `versionName`: String (e.g., "1.2.0")
  - `versionCode`: Long (e.g., 2)
  - `apkUrl`: String (Firebase Storage download URL)
  - `apkStoragePath`: String
  - `apkSize`: Long
  - `minAndroidVersion`: Int
  - `changelog`: String
  - `published`: Boolean
  - `createdAt`: Timestamp

- **`admins/{uid}`**
  - `email`: String
  - `role`: "admin"
  - `grantedAt`: Timestamp

### B. Firebase Storage Structure
- `apps/{appId}/icon/{filename}.png` (App Icon)
- `apps/{appId}/screenshots/{filename}.png` (App Screenshots)
- `apps/{appId}/versions/{versionId}/app.apk` (Raw APK Binary)

---

## 3. Security Rules

### Firestore Security (`firestore.rules`)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null && (
        request.auth.token.admin == true ||
        exists(/databases/$(database)/documents/admins/$(request.auth.uid))
      );
    }

    match /admins/{userId} {
      allow read: if request.auth != null && (request.auth.uid == userId || isAdmin());
      allow write: if isAdmin();
    }

    match /apps/{appId} {
      allow read: if (resource != null && resource.data.published == true) || isAdmin();
      allow create, delete: if isAdmin();
      allow update: if isAdmin() || (
        resource != null &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['downloadCount']) &&
        request.resource.data.downloadCount == resource.data.downloadCount + 1
      );

      match /versions/{versionId} {
        allow read: if (resource != null && resource.data.published == true) || isAdmin();
        allow write: if isAdmin();
      }
    }
  }
}
```

### Storage Security (`storage.rules`)
- Icons & screenshots: Public read, Admin write (<20MB, images only).
- APK Binaries: Public read for installation, Admin write only (<500MB).

---

## 4. Setup & Running in Android Studio

1. **Open Project**:
   - Launch Android Studio
   - Click **Open** and select directory: `d:\web\mmmut\play store`
   - Android Studio will automatically recognize Gradle and sync the dependencies.

2. **Add Your Firebase Configuration**:
   - Go to [Firebase Console](https://console.firebase.google.com/) -> Create or select your project.
   - Add an Android App with package name: `com.mmmut.appstore`
   - Download `google-services.json` and place it in the `app/` directory (replacing the placeholder).
   - Enable **Firebase Authentication** (Email/Password provider).
   - Enable **Cloud Firestore** and **Firebase Storage**.
   - Deploy security rules:
     ```bash
     firebase deploy --only firestore:rules,storage:rules
     ```

3. **Granting First Administrator Privileges**:
   - Register your account email via Firebase Console or sign up.
   - Run the included tool:
     ```bash
     cd admin-tools
     npm install
     # Place your serviceAccountKey.json in admin-tools/
     node set-admin.js your-email@example.com
     ```

4. **Build & Run**:
   - In Android Studio, select a connected Android device or Emulator.
   - Press **Run** (or `Shift + F10`).
   - To build a standalone APK:
     - Android Studio -> **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**.

---

## 5. APK Installation Flow

1. User selects an app from the Store and taps **[INSTALL]** or **[UPDATE]**.
2. AppVault downloads the binary from Firebase Storage directly to its isolated cache (`cacheDir/apks/`).
3. Upon completion, AppVault securely generates a content URI using `androidx.core.content.FileProvider`.
4. It issues an `Intent.ACTION_VIEW` with MIME type `application/vnd.android.package-archive` and `FLAG_GRANT_READ_URI_PERMISSION`.
5. If Android 8.0+ has not granted "Install unknown apps" permission to AppVault, the user is cleanly prompted with a dialog to allow it in Settings.
6. Android OS handles the installation cleanly and securely.
7. Upon successful download, AppVault atomically increments the application's `downloadCount` in Firestore.
