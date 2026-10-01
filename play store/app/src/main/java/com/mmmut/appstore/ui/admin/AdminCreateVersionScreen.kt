package com.mmmut.appstore.ui.admin

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
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.mmmut.appstore.data.model.AppVersion
import com.mmmut.appstore.data.repository.AppRepository
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminCreateVersionScreen(
    appId: String,
    appRepository: AppRepository,
    onSuccess: () -> Unit,
    onBackClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    var versionName by remember { mutableStateOf("1.0.0") }
    var versionCodeText by remember { mutableStateOf("1") }
    var releaseTag by remember { mutableStateOf("v1.0.0") }
    var apkUrl by remember { mutableStateOf("") }
    var releaseNotes by remember { mutableStateOf("") }
    var minAndroidText by remember { mutableStateOf("26") }
    var published by remember { mutableStateOf(true) }

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

    var versionNameError by remember { mutableStateOf<String?>(null) }
    var versionCodeError by remember { mutableStateOf<String?>(null) }
    var releaseTagError by remember { mutableStateOf<String?>(null) }
    var apkUrlError by remember { mutableStateOf<String?>(null) }

    fun validate(): Boolean {
        var valid = true

        // 1. Version name
        if (versionName.isBlank()) {
            versionNameError = "Version name cannot be empty (e.g. 1.1.0)"
            valid = false
        } else {
            versionNameError = null
        }

        // 2. Version code
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

        // 3. Release tag
        if (releaseTag.isBlank()) {
            releaseTagError = "Release tag cannot be empty (e.g. v1.1.0)"
            valid = false
        } else {
            releaseTagError = null
        }

        // 4. APK Download URL
        val trimmedUrl = apkUrl.trim()
        if (trimmedUrl.isBlank()) {
            apkUrlError = "APK URL cannot be empty"
            valid = false
        } else if (!trimmedUrl.startsWith("http://", ignoreCase = true) && !trimmedUrl.startsWith("https://", ignoreCase = true)) {
            apkUrlError = "APK URL must be a valid HTTP/HTTPS URL"
            valid = false
        } else if (!trimmedUrl.contains("github.com", ignoreCase = true) || !trimmedUrl.endsWith(".apk", ignoreCase = true)) {
            apkUrlError = "APK URL should point to a GitHub Release APK (e.g. https://github.com/OWNER/REPO/releases/download/v1.1.0/app-release.apk)"
            valid = false
        } else {
            apkUrlError = null
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
                    if (releaseTag.isBlank() || releaseTag == "v${versionName}") {
                        releaseTag = "v$it"
                    }
                },
                label = { Text("Version Name (e.g. 1.1.0) *") },
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

            // Release Tag
            OutlinedTextField(
                value = releaseTag,
                onValueChange = {
                    releaseTag = it.trim()
                    if (releaseTagError != null) releaseTagError = null
                },
                label = { Text("Release Tag (e.g. v1.1.0) *") },
                placeholder = { Text("v1.1.0") },
                isError = releaseTagError != null,
                supportingText = releaseTagError?.let { { Text(it) } },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            // APK Download URL (GitHub Releases)
            OutlinedTextField(
                value = apkUrl,
                onValueChange = {
                    apkUrl = it.trim()
                    if (apkUrlError != null) apkUrlError = null
                },
                label = { Text("APK Download URL (GitHub Releases) *") },
                placeholder = { Text("https://github.com/OWNER/REPO/releases/download/v1.1.0/app-release.apk") },
                isError = apkUrlError != null,
                supportingText = {
                    if (apkUrlError != null) {
                        Text(apkUrlError!!)
                    } else {
                        Text("Direct asset download link from a published GitHub Release")
                    }
                },
                singleLine = false,
                maxLines = 3,
                modifier = Modifier.fillMaxWidth()
            )

            // Info Card about GitHub Releases
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                )
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.Top,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Info,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp)
                    )
                    Text(
                        text = "Build your APK, create a GitHub Release with tag matching above, attach the APK asset, and paste the direct download URL here.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Release Notes / Changelog
            OutlinedTextField(
                value = releaseNotes,
                onValueChange = { releaseNotes = it },
                label = { Text("Release Notes / Changelog") },
                placeholder = { Text("• Bug fixes and performance improvements\n• New feature...") },
                minLines = 3,
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

                    isSavingVersion = true
                    coroutineScope.launch {
                        val version = AppVersion(
                            id = versionId,
                            appId = appId,
                            versionName = versionName.trim(),
                            versionCode = versionCodeText.toLongOrNull() ?: 1L,
                            releaseTag = releaseTag.trim(),
                            apkUrl = apkUrl.trim(),
                            releaseNotes = releaseNotes.trim(),
                            changelog = releaseNotes.trim(),
                            apkStoragePath = "",
                            apkSize = 0L,
                            minAndroidVersion = minAndroidText.toIntOrNull() ?: 26,
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
                enabled = !isSavingVersion,
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
