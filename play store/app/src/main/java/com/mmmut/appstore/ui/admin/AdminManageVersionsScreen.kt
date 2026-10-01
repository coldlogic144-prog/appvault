package com.mmmut.appstore.ui.admin

import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.SuggestionChipDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.mmmut.appstore.data.model.AppItem
import com.mmmut.appstore.data.model.AppVersion
import com.mmmut.appstore.data.repository.AppRepository
import com.mmmut.appstore.ui.components.EmptyStateView
import com.mmmut.appstore.ui.components.LoadingView
import com.mmmut.appstore.ui.theme.InstallGreenLight
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminManageVersionsScreen(
    appId: String,
    appRepository: AppRepository,
    onAddNewVersionClick: () -> Unit,
    onBackClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    var app by remember { mutableStateOf<AppItem?>(null) }
    var versions by remember { mutableStateOf<List<AppVersion>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var versionToDelete by remember { mutableStateOf<AppVersion?>(null) }

    fun refreshData() {
        isLoading = true
        coroutineScope.launch {
            appRepository.getAppDetails(appId).collect { appResult ->
                app = appResult.getOrNull()
            }
        }
        coroutineScope.launch {
            appRepository.getAppVersions(appId, includeDrafts = true).collect { versionsResult ->
                isLoading = false
                versions = versionsResult.getOrDefault(emptyList())
            }
        }
    }

    LaunchedEffect(appId) {
        refreshData()
    }

    if (versionToDelete != null) {
        AlertDialog(
            onDismissRequest = { versionToDelete = null },
            icon = { Icon(Icons.Default.Delete, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
            title = { Text("Delete Version") },
            text = { Text("Are you sure you want to delete version '${versionToDelete?.versionName}' (code ${versionToDelete?.versionCode})?") },
            confirmButton = {
                Button(
                    onClick = {
                        versionToDelete?.let { v ->
                            coroutineScope.launch {
                                appRepository.deleteVersion(appId, v.id).fold(
                                    onSuccess = {
                                        snackbarHostState.showSnackbar("Version deleted")
                                    },
                                    onFailure = { err ->
                                        snackbarHostState.showSnackbar("Error: ${err.localizedMessage}")
                                    }
                                )
                            }
                        }
                        versionToDelete = null
                    }
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { versionToDelete = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("Versions: ${app?.name ?: "App"}") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { refreshData() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onAddNewVersionClick,
                icon = { Icon(Icons.Default.Add, contentDescription = null) },
                text = { Text("New Version") }
            )
        },
        modifier = modifier
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when {
                isLoading && versions.isEmpty() -> {
                    LoadingView(message = "Loading versions...")
                }

                versions.isEmpty() -> {
                    EmptyStateView(
                        icon = Icons.Default.Layers,
                        title = "No Versions Yet",
                        message = "No APK versions published for this app yet. Click '+ New Version' to upload an APK.",
                        actionText = "Upload First Version",
                        onActionClick = onAddNewVersionClick
                    )
                }

                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 80.dp)
                    ) {
                        items(versions, key = { it.id }) { version ->
                            VersionItemCard(
                                version = version,
                                onTogglePublished = {
                                    coroutineScope.launch {
                                        appRepository.toggleVersionPublish(appId, version.id, !version.published)
                                    }
                                },
                                onDeleteClick = { versionToDelete = version }
                            )
                            HorizontalDivider(
                                modifier = Modifier.padding(horizontal = 16.dp),
                                color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun VersionItemCard(
    version: AppVersion,
    onTogglePublished: () -> Unit,
    onDeleteClick: () -> Unit
) {
    val dateFormat = remember { SimpleDateFormat("MMM dd, yyyy", Locale.getDefault()) }
    val dateStr = remember(version.createdAt) {
        version.createdAt?.toDate()?.let { dateFormat.format(it) } ?: "Recently"
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Version ${version.versionName}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Build ${version.versionCode} • $dateStr",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                SuggestionChip(
                    onClick = onTogglePublished,
                    label = {
                        Text(
                            text = if (version.published) "Published" else "Draft",
                            style = MaterialTheme.typography.labelSmall
                        )
                    },
                    colors = SuggestionChipDefaults.suggestionChipColors(
                        containerColor = if (version.published) InstallGreenLight.copy(alpha = 0.2f) else MaterialTheme.colorScheme.surfaceVariant,
                        labelColor = if (version.published) InstallGreenLight else MaterialTheme.colorScheme.onSurfaceVariant
                    ),
                    border = null
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            val tag = if (version.releaseTag.isNotBlank()) "Tag: ${version.releaseTag} • " else ""
            Text(
                text = "$tag${version.minAndroidVersionText}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.outline
            )

            if (version.apkUrl.isNotBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = version.apkUrl,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                    maxLines = 1
                )
            }

            if (version.displayNotes.isNotBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = version.displayNotes,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                IconButton(onClick = onDeleteClick) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "Delete version",
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }
}
