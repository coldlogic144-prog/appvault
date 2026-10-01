package com.mmmut.appstore.ui.details

import android.content.Intent
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Android
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.mmmut.appstore.data.installer.ApkInstaller
import com.mmmut.appstore.data.model.AppItem
import com.mmmut.appstore.data.model.DownloadState
import com.mmmut.appstore.ui.components.ChangelogCard
import com.mmmut.appstore.ui.components.ErrorStateView
import com.mmmut.appstore.ui.components.LoadingView
import com.mmmut.appstore.ui.components.ScreenshotsGallery
import com.mmmut.appstore.ui.components.SectionHeader
import com.mmmut.appstore.ui.components.StatsBadgesRow
import com.mmmut.appstore.ui.theme.InstallGreenLight
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppDetailsScreen(
    viewModel: AppDetailsViewModel,
    apkInstaller: ApkInstaller,
    onBackClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    var isDescriptionExpanded by remember { mutableStateOf(false) }
    var showPermissionDialog by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.checkInstallPermission()
    }

    if (showPermissionDialog) {
        AlertDialog(
            onDismissRequest = { showPermissionDialog = false },
            icon = { Icon(Icons.Default.Warning, contentDescription = null) },
            title = { Text("Permission Required") },
            text = {
                Text("Android requires permission to install applications from unknown sources. Please enable 'Allow from this source' for AppVault in Android Settings.")
            },
            confirmButton = {
                Button(onClick = {
                    showPermissionDialog = false
                    context.startActivity(apkInstaller.getManageUnknownAppSourcesIntent())
                }) {
                    Text("Open Settings")
                }
            },
            dismissButton = {
                TextButton(onClick = { showPermissionDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {},
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                actions = {
                    state.app?.let { app ->
                        IconButton(onClick = {
                            val sendIntent = Intent().apply {
                                action = Intent.ACTION_SEND
                                putExtra(Intent.EXTRA_TEXT, "Check out ${app.name} on AppVault Store!")
                                type = "text/plain"
                            }
                            context.startActivity(Intent.createChooser(sendIntent, "Share App"))
                        }) {
                            Icon(Icons.Default.Share, contentDescription = "Share")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        modifier = modifier
    ) { innerPadding ->
        when {
            state.isLoading -> {
                LoadingView(message = "Loading application details...")
            }

            state.errorMessage != null && state.app == null -> {
                ErrorStateView(
                    message = state.errorMessage ?: "App not found",
                    onRetry = { viewModel.loadDetails() }
                )
            }

            state.app != null -> {
                val app = state.app!!
                val minAndroidText = state.latestVersion?.minAndroidVersionText
                    ?: "Android API ${app.minAndroidVersion}+"

                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding),
                    contentPadding = PaddingValues(bottom = 32.dp)
                ) {
                    // Header: Icon, Name, Developer, Category
                    item {
                        AppHeaderSection(app = app)
                        Spacer(modifier = Modifier.height(16.dp))
                    }

                    // Install / Update / Open Button + Download progress
                    item {
                        ActionButtonsSection(
                            state = state,
                            onInstallClick = {
                                if (!apkInstaller.canRequestPackageInstalls()) {
                                    showPermissionDialog = true
                                } else {
                                    viewModel.installOrUpdateApp()
                                }
                            },
                            onCancelClick = { viewModel.cancelDownload() },
                            onOpenClick = { viewModel.openInstalledApp() }
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                    }

                    // Badges: Category, Downloads, Size, Min Android
                    item {
                        StatsBadgesRow(
                            app = app,
                            minAndroidText = minAndroidText
                        )
                        HorizontalDivider(
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                            color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
                        )
                    }

                    // What's New / Changelog
                    state.latestVersion?.changelog?.let { changelog ->
                        if (changelog.isNotBlank()) {
                            item {
                                ChangelogCard(
                                    versionName = state.latestVersion?.versionName ?: app.latestVersionName,
                                    changelog = changelog
                                )
                            }
                        }
                    }

                    // Screenshots Gallery
                    if (app.screenshots.isNotEmpty()) {
                        item {
                            SectionHeader(title = "Screenshots")
                            ScreenshotsGallery(screenshots = app.screenshots)
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                    }

                    // Description
                    item {
                        SectionHeader(title = "About this app")
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp)
                                .animateContentSize()
                        ) {
                            Text(
                                text = app.description.ifBlank { app.shortDescription },
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = if (isDescriptionExpanded) Int.MAX_VALUE else 4,
                                overflow = TextOverflow.Ellipsis
                            )

                            Text(
                                text = if (isDescriptionExpanded) "Show less" else "Read more",
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier
                                    .padding(top = 8.dp)
                                    .clickable { isDescriptionExpanded = !isDescriptionExpanded }
                            )
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                    }

                    // App Information Details Table
                    item {
                        SectionHeader(title = "App Info")
                        AppInfoTable(app = app, minAndroidText = minAndroidText)
                    }
                }
            }
        }
    }
}

@Composable
private fun AppHeaderSection(app: AppItem) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (app.iconUrl.isNotBlank()) {
            AsyncImage(
                model = app.iconUrl,
                contentDescription = app.name,
                modifier = Modifier
                    .size(80.dp)
                    .clip(RoundedCornerShape(18.dp)),
                contentScale = ContentScale.Crop
            )
        } else {
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Android,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.size(44.dp)
                )
            }
        }

        Spacer(modifier = Modifier.width(20.dp))

        Column {
            Text(
                text = app.name,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            Text(
                text = app.developer,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary
            )

            Text(
                text = app.categoryDisplayName,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun ActionButtonsSection(
    state: AppDetailsUiState,
    onInstallClick: () -> Unit,
    onCancelClick: () -> Unit,
    onOpenClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
    ) {
        when (val dlState = state.downloadState) {
            is DownloadState.Downloading -> {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (dlState.progress >= 0) "Downloading: ${dlState.progress}%" else "Downloading...",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        IconButton(onClick = onCancelClick) {
                            Icon(Icons.Default.Close, contentDescription = "Cancel download")
                        }
                    }

                    if (dlState.progress >= 0) {
                        LinearProgressIndicator(
                            progress = { dlState.progress / 100f },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp)
                                .clip(RoundedCornerShape(4.dp)),
                            color = InstallGreenLight
                        )
                    } else {
                        LinearProgressIndicator(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp)
                                .clip(RoundedCornerShape(4.dp)),
                            color = InstallGreenLight
                        )
                    }
                }
            }

            DownloadState.Installing -> {
                Button(
                    onClick = {},
                    enabled = false,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    shape = RoundedCornerShape(24.dp)
                ) {
                    Text("Starting Android Installer...")
                }
            }

            is DownloadState.Failed -> {
                Column {
                    Text(
                        text = "Error: ${dlState.message}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )
                    Button(
                        onClick = onInstallClick,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(24.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = InstallGreenLight)
                    ) {
                        Text("Retry Download", fontWeight = FontWeight.Bold)
                    }
                }
            }

            else -> {
                val installed = state.installedInfo
                if (installed != null && installed.isInstalled) {
                    if (installed.hasUpdate) {
                        Button(
                            onClick = onInstallClick,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp),
                            shape = RoundedCornerShape(24.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = InstallGreenLight)
                        ) {
                            Text("UPDATE", fontWeight = FontWeight.Bold)
                        }
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            OutlinedButton(
                                onClick = onInstallClick,
                                modifier = Modifier
                                    .weight(1f)
                                    .height(48.dp),
                                shape = RoundedCornerShape(24.dp)
                            ) {
                                Text("Re-install")
                            }

                            Button(
                                onClick = onOpenClick,
                                modifier = Modifier
                                    .weight(1f)
                                    .height(48.dp),
                                shape = RoundedCornerShape(24.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = InstallGreenLight)
                            ) {
                                Icon(Icons.Default.OpenInNew, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("OPEN", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                } else {
                    Button(
                        onClick = onInstallClick,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(24.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = InstallGreenLight)
                    ) {
                        Text("INSTALL", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun AppInfoTable(
    app: AppItem,
    minAndroidText: String
) {
    val dateFormat = remember { SimpleDateFormat("MMM dd, yyyy", Locale.getDefault()) }
    val updatedDateStr = remember(app.updatedAt) {
        app.updatedAt?.toDate()?.let { dateFormat.format(it) } ?: "Recently"
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            InfoTableRow(label = "Version", value = app.latestVersionName)
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
            InfoTableRow(label = "Updated on", value = updatedDateStr)
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
            InfoTableRow(label = "Requires Android", value = minAndroidText)
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
            InfoTableRow(label = "Download size", value = app.formattedSize)
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
            InfoTableRow(label = "Package name", value = app.packageName)
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
            InfoTableRow(label = "Developer", value = app.developer)
        }
    }
}

@Composable
private fun InfoTableRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}
