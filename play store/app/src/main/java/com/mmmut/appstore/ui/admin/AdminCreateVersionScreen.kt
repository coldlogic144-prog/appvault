package com.mmmut.appstore.ui.admin

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Android
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.mmmut.appstore.data.model.AppVersion
import com.mmmut.appstore.data.model.UploadState
import com.mmmut.appstore.data.repository.AppRepository
import com.mmmut.appstore.data.repository.StorageRepository
import com.mmmut.appstore.ui.theme.InstallGreenLight
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminCreateVersionScreen(
    appId: String,
    appRepository: AppRepository,
    storageRepository: StorageRepository,
    onSuccess: () -> Unit,
    onBackClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    var versionName by remember { mutableStateOf("1.0.0") }
    var versionCodeText by remember { mutableStateOf("1") }
    var minAndroidText by remember { mutableStateOf("26") }
    var changelog by remember { mutableStateOf("") }
    var published by remember { mutableStateOf(true) }

    // APK File Selection & Upload
    var selectedApkUri by remember { mutableStateOf<Uri?>(null) }
    var selectedApkFileName by remember { mutableStateOf<String?>(null) }
    var selectedApkSizeBytes by remember { mutableLongStateOf(0L) }
    var uploadedApkUrl by remember { mutableStateOf("") }

    var uploadState by remember { mutableStateOf<UploadState>(UploadState.Idle) }
    var uploadJob by remember { mutableStateOf<Job?>(null) }
    var isSavingVersion by remember { mutableStateOf(false) }

    // Existing highest version code for validation
    var highestExistingVersionCode by remember { mutableLongStateOf(0L) }

    // Unique version id
    val versionId = remember { "v_${System.currentTimeMillis()}" }

    LaunchedEffect(appId) {
        appRepository.getAppVersions(appId, includeDrafts = true).collect { result ->
            val versions = result.getOrDefault(emptyList())
            val maxCode = versions.maxOfOrNull { it.versionCode } ?: 0L
            highestExistingVersionCode = maxCode
            if (maxCode > 0) {
                versionCodeText = "${maxCode + 1}"
            }
        }
    }

    val apkPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            val (name, size) = queryFileInfo(context, uri)
            selectedApkUri = uri
            selectedApkFileName = name
            selectedApkSizeBytes = size
        }
    }

    fun startApkUpload() {
        val uri = selectedApkUri ?: return
        uploadJob = coroutineScope.launch {
            storageRepository.uploadApk(appId, versionId, uri).collect { state ->
                uploadState = state
                if (state is UploadState.Success) {
                    uploadedApkUrl = state.downloadUrl
                }
            }
        }
    }

    fun cancelApkUpload() {
        uploadJob?.cancel()
        uploadState = UploadState.Idle
    }

    var versionNameError by remember { mutableStateOf<String?>(null) }
    var versionCodeError by remember { mutableStateOf<String?>(null) }

    fun validate(): Boolean {
        var valid = true

        if (versionName.isBlank()) {
            versionNameError = "Version name cannot be empty (e.g. 1.0.0)"
            valid = false
        } else {
            versionNameError = null
        }

        val code = versionCodeText.toLongOrNull()
        if (code == null || code <= 0) {
            versionCodeError = "Version code must be a positive integer"
            valid = false
        } else if (code <= highestExistingVersionCode) {
            versionCodeError = "Version code must be greater than current highest ($highestExistingVersionCode)"
            valid = false
        } else {
            versionCodeError = null
        }

        return valid
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("Publish New Version") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        modifier = modifier
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Version Name
            OutlinedTextField(
                value = versionName,
                onValueChange = {
                    versionName = it.trim()
                    if (versionNameError != null) versionNameError = null
                },
                label = { Text("Version Name (e.g. 1.2.0) *") },
                isError = versionNameError != null,
                supportingText = versionNameError?.let { { Text(it) } },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            // Version Code
            OutlinedTextField(
                value = versionCodeText,
                onValueChange = {
                    versionCodeText = it.trim()
                    if (versionCodeError != null) versionCodeError = null
                },
                label = { Text("Version Code (Numeric) *") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                isError = versionCodeError != null,
                supportingText = {
                    if (versionCodeError != null) {
                        Text(versionCodeError!!)
                    } else if (highestExistingVersionCode > 0) {
                        Text("Current highest version code in store is $highestExistingVersionCode")
                    }
                },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            // Minimum Android SDK
            OutlinedTextField(
                value = minAndroidText,
                onValueChange = { minAndroidText = it.trim() },
                label = { Text("Minimum Android SDK API Level") },
                supportingText = { Text("26 = Android 8.0, 29 = Android 10, 33 = Android 13") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            // Changelog
            OutlinedTextField(
                value = changelog,
                onValueChange = { changelog = it },
                label = { Text("Changelog / What's New") },
                placeholder = { Text("• Bug fixes and performance improvements\n• New feature...") },
                minLines = 3,
                modifier = Modifier.fillMaxWidth()
            )

            // APK File Selection Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                )
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "APK Package Binary",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    if (selectedApkFileName != null) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Default.Android, contentDescription = null, tint = InstallGreenLight)
                            Spacer(modifier = Modifier.width(8.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = selectedApkFileName ?: "Selected APK",
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.SemiBold
                                )
                                val mb = selectedApkSizeBytes.toDouble() / (1024 * 1024)
                                Text(
                                    text = String.format("%.1f MB", mb),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        when (val state = uploadState) {
                            is UploadState.Uploading -> {
                                LinearProgressIndicator(
                                    progress = { state.progress / 100f },
                                    modifier = Modifier.fillMaxWidth(),
                                    color = InstallGreenLight
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(state.message, style = MaterialTheme.typography.labelSmall)
                                    IconButton(onClick = { cancelApkUpload() }) {
                                        Icon(Icons.Default.Close, contentDescription = "Cancel upload")
                                    }
                                }
                            }

                            is UploadState.Success -> {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Check, contentDescription = null, tint = InstallGreenLight)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "APK uploaded to Firebase Storage successfully!",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = InstallGreenLight,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }

                            is UploadState.Failed -> {
                                Text(
                                    text = "Upload Error: ${state.message}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.error
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Button(onClick = { startApkUpload() }) {
                                    Text("Retry Upload")
                                }
                            }

                            UploadState.Idle -> {
                                Button(
                                    onClick = { startApkUpload() },
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Icon(Icons.Default.CloudUpload, contentDescription = null)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Upload APK to Firebase Storage")
                                }
                            }
                        }
                    } else {
                        OutlinedButton(
                            onClick = { apkPickerLauncher.launch("application/vnd.android.package-archive") },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Default.Android, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Select APK File from Device")
                        }
                    }
                }
            }

            // Publish Switch
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Publish Immediately",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "Marks this version as latest published version for users",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Switch(
                    checked = published,
                    onCheckedChange = { published = it }
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Save Version Button
            Button(
                onClick = {
                    if (!validate()) return@Button
                    if (uploadedApkUrl.isBlank() && uploadState !is UploadState.Success) {
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("Please upload the APK file before publishing this version")
                        }
                        return@Button
                    }

                    isSavingVersion = true
                    coroutineScope.launch {
                        val version = AppVersion(
                            id = versionId,
                            appId = appId,
                            versionName = versionName.trim(),
                            versionCode = versionCodeText.toLongOrNull() ?: 1L,
                            apkUrl = uploadedApkUrl,
                            apkStoragePath = "apps/$appId/versions/$versionId/app.apk",
                            apkSize = selectedApkSizeBytes,
                            minAndroidVersion = minAndroidText.toIntOrNull() ?: 26,
                            changelog = changelog.trim(),
                            published = published
                        )

                        val result = appRepository.createVersion(appId, version)
                        isSavingVersion = false
                        result.fold(
                            onSuccess = {
                                onSuccess()
                            },
                            onFailure = { err ->
                                snackbarHostState.showSnackbar("Failed to create version: ${err.localizedMessage}")
                            }
                        )
                    }
                },
                enabled = !isSavingVersion && uploadState !is UploadState.Uploading,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(24.dp)
            ) {
                if (isSavingVersion) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Icon(Icons.Default.Check, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Publish Version")
                }
            }
        }
    }
}

private fun queryFileInfo(context: Context, uri: Uri): Pair<String, Long> {
    var name = "app.apk"
    var size = 0L
    try {
        val cursor = context.contentResolver.query(uri, null, null, null, null)
        cursor?.use {
            if (it.moveToFirst()) {
                val nameIndex = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                val sizeIndex = it.getColumnIndex(OpenableColumns.SIZE)
                if (nameIndex != -1) name = it.getString(nameIndex) ?: "app.apk"
                if (sizeIndex != -1) size = it.getLong(sizeIndex)
            }
        }
    } catch (_: Exception) {}
    return Pair(name, size)
}
