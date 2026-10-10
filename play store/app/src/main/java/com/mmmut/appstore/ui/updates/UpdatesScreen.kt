package com.mmmut.appstore.ui.updates

import androidx.compose.animation.AnimatedVisibility
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.Android
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.CloudDownload
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
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
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.mmmut.appstore.data.model.DeviceAppInfo
import com.mmmut.appstore.data.model.DownloadState
import com.mmmut.appstore.ui.components.EmptyStateView
import com.mmmut.appstore.ui.components.LoadingView
import com.mmmut.appstore.ui.components.SectionHeader
import com.mmmut.appstore.ui.theme.InstallGreenLight

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UpdatesScreen(
    viewModel: UpdatesViewModel,
    onAppClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val state by viewModel.uiState.collectAsState()
    var isSearchExpanded by remember { mutableStateOf(false) }

    // Automatically re-scan whenever this screen is resumed from background
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        viewModel.scanForUpdates()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Manage & Updates",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        if (state.totalDeviceAppsCount > 0) {
                            Text(
                                text = "${state.totalDeviceAppsCount} installed apps detected on device",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                },
                actions = {
                    IconButton(onClick = { isSearchExpanded = !isSearchExpanded }) {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = "Search installed apps"
                        )
                    }
                    IconButton(onClick = { viewModel.scanForUpdates() }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Scan for updates"
                        )
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
        ) {
            // Search Input Row (Collapsible)
            AnimatedVisibility(visible = isSearchExpanded) {
                OutlinedTextField(
                    value = state.searchQuery,
                    onValueChange = { viewModel.setSearchQuery(it) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    placeholder = { Text("Search installed apps by name or package...") },
                    leadingIcon = {
                        Icon(Icons.Default.Search, contentDescription = null)
                    },
                    trailingIcon = {
                        if (state.searchQuery.isNotBlank()) {
                            IconButton(onClick = { viewModel.setSearchQuery("") }) {
                                Icon(Icons.Default.Clear, contentDescription = "Clear")
                            }
                        }
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp)
                )
            }

            // Filter Chips Row
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                item {
                    FilterChip(
                        selected = state.selectedFilter == UpdatesFilter.ALL,
                        onClick = { viewModel.setFilter(UpdatesFilter.ALL) },
                        label = { Text("All (${state.totalDeviceAppsCount})") },
                        colors = FilterChipDefaults.filterChipColors()
                    )
                }
                item {
                    FilterChip(
                        selected = state.selectedFilter == UpdatesFilter.UPDATES,
                        onClick = { viewModel.setFilter(UpdatesFilter.UPDATES) },
                        label = { Text("Updates (${state.updatableApps.size})") },
                        leadingIcon = if (state.updatableApps.isNotEmpty()) {
                            {
                                Icon(
                                    imageVector = Icons.Default.SystemUpdate,
                                    contentDescription = null,
                                    tint = InstallGreenLight,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        } else null
                    )
                }
                item {
                    FilterChip(
                        selected = state.selectedFilter == UpdatesFilter.STORE_APPS,
                        onClick = { viewModel.setFilter(UpdatesFilter.STORE_APPS) },
                        label = { Text("Store Apps (${state.updatableApps.size + state.upToDateApps.size})") },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.Verified,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    )
                }
                item {
                    FilterChip(
                        selected = state.selectedFilter == UpdatesFilter.DEVICE_APPS,
                        onClick = { viewModel.setFilter(UpdatesFilter.DEVICE_APPS) },
                        label = { Text("Device (${state.deviceApps.size})") },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.PhoneAndroid,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    )
                }
            }

            when {
                state.isScanning && state.deviceApps.isEmpty() -> {
                    LoadingView(message = "Scanning installed applications and updates...")
                }

                state.deviceApps.isEmpty() && state.updatableApps.isEmpty() && state.upToDateApps.isEmpty() -> {
                    EmptyStateView(
                        icon = Icons.Default.SystemUpdate,
                        title = "No Applications Detected",
                        message = "AppVault is scanning your device packages. Tap refresh to check again.",
                        actionText = "Refresh Device Apps",
                        onActionClick = { viewModel.scanForUpdates() }
                    )
                }

                else -> {
                    val filteredDeviceApps = remember(state.deviceApps, state.searchQuery, state.selectedFilter) {
                        val query = state.searchQuery.trim().lowercase()
                        state.deviceApps.filter { app ->
                            val matchesQuery = query.isBlank() ||
                                app.appName.lowercase().contains(query) ||
                                app.packageName.lowercase().contains(query)

                            val matchesFilter = when (state.selectedFilter) {
                                UpdatesFilter.ALL -> true
                                UpdatesFilter.UPDATES -> app.hasUpdate
                                UpdatesFilter.STORE_APPS -> app.matchingStoreApp != null
                                UpdatesFilter.DEVICE_APPS -> true
                            }

                            matchesQuery && matchesFilter
                        }
                    }

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 32.dp)
                    ) {
                        // Section 1: Overview Banner (Updates Pending or All Up-To-Date)
                        if (state.selectedFilter == UpdatesFilter.ALL || state.selectedFilter == UpdatesFilter.UPDATES) {
                            if (state.updatableApps.isNotEmpty()) {
                                item {
                                    Card(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(16.dp),
                                        colors = CardDefaults.cardColors(
                                            containerColor = MaterialTheme.colorScheme.primaryContainer
                                        ),
                                        shape = RoundedCornerShape(16.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(16.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.SystemUpdate,
                                                contentDescription = null,
                                                tint = MaterialTheme.colorScheme.primary,
                                                modifier = Modifier.size(32.dp)
                                            )
                                            Spacer(modifier = Modifier.width(16.dp))
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(
                                                    text = "${state.updatableApps.size} Updates Available",
                                                    style = MaterialTheme.typography.titleMedium,
                                                    fontWeight = FontWeight.Bold
                                                )
                                                Text(
                                                    text = "New releases are available for your installed store applications.",
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
                                                )
                                            }
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Button(
                                                onClick = { viewModel.updateAll() },
                                                colors = ButtonDefaults.buttonColors(
                                                    containerColor = InstallGreenLight
                                                ),
                                                shape = RoundedCornerShape(20.dp),
                                                enabled = !state.isUpdatingAll
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.CloudDownload,
                                                    contentDescription = null,
                                                    modifier = Modifier.size(16.dp)
                                                )
                                                Spacer(modifier = Modifier.width(6.dp))
                                                Text("Update All", fontWeight = FontWeight.Bold)
                                            }
                                        }
                                    }
                                }

                                item {
                                    SectionHeader(title = "Updates Available (${state.updatableApps.size})")
                                }

                                items(state.updatableApps, key = { "updatable_${it.app.id}" }) { item ->
                                    UpdatableAppCard(
                                        item = item,
                                        onAppClick = { onAppClick(item.app.id) },
                                        onUpdateClick = { viewModel.updateApp(item) }
                                    )
                                    HorizontalDivider(
                                        modifier = Modifier.padding(horizontal = 16.dp),
                                        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
                                    )
                                }
                            } else if (state.selectedFilter == UpdatesFilter.ALL) {
                                item {
                                    Card(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(16.dp),
                                        colors = CardDefaults.cardColors(
                                            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)
                                        ),
                                        shape = RoundedCornerShape(14.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(16.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.CheckCircle,
                                                contentDescription = null,
                                                tint = InstallGreenLight,
                                                modifier = Modifier.size(28.dp)
                                            )
                                            Spacer(modifier = Modifier.width(12.dp))
                                            Column {
                                                Text(
                                                    text = "All Applications Up to Date",
                                                    style = MaterialTheme.typography.titleMedium,
                                                    fontWeight = FontWeight.SemiBold
                                                )
                                                Text(
                                                    text = "No pending updates for your installed store applications.",
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // Section 2: Store Apps (Up to date)
                        if (state.selectedFilter == UpdatesFilter.ALL || state.selectedFilter == UpdatesFilter.STORE_APPS) {
                            if (state.upToDateApps.isNotEmpty()) {
                                item {
                                    SectionHeader(title = "Installed Store Apps (${state.upToDateApps.size})")
                                }

                                items(state.upToDateApps, key = { "uptodate_${it.app.id}" }) { item ->
                                    UpToDateAppRow(
                                        item = item,
                                        onAppClick = { onAppClick(item.app.id) },
                                        onOpenClick = { viewModel.launchApp(item.installedInfo.resolvedPackageName) }
                                    )
                                    HorizontalDivider(
                                        modifier = Modifier.padding(horizontal = 16.dp),
                                        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
                                    )
                                }
                            }
                        }

                        // Section 3: Applications on this Device
                        if (state.selectedFilter == UpdatesFilter.ALL || state.selectedFilter == UpdatesFilter.DEVICE_APPS) {
                            item {
                                SectionHeader(title = "Installed on this Device (${filteredDeviceApps.size})")
                            }

                            if (filteredDeviceApps.isEmpty()) {
                                item {
                                    Text(
                                        text = if (state.searchQuery.isNotBlank()) "No applications found matching \"${state.searchQuery}\"" else "No applications detected.",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 24.dp)
                                    )
                                }
                            } else {
                                items(filteredDeviceApps, key = { "device_${it.packageName}" }) { devApp ->
                                    DeviceAppRow(
                                        deviceApp = devApp,
                                        onAppClick = {
                                            if (devApp.matchingStoreApp != null) {
                                                onAppClick(devApp.matchingStoreApp.id)
                                            } else {
                                                viewModel.launchApp(devApp.packageName)
                                            }
                                        },
                                        onOpenClick = { viewModel.launchApp(devApp.packageName) }
                                    )
                                    HorizontalDivider(
                                        modifier = Modifier.padding(horizontal = 16.dp),
                                        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun UpdatableAppCard(
    item: UpdatableAppItem,
    onAppClick: () -> Unit,
    onUpdateClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onAppClick)
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (item.app.iconUrl.isNotBlank()) {
                val context = LocalContext.current
                val iconRequest = remember(item.app.iconUrl) {
                    ImageRequest.Builder(context)
                        .data(item.app.iconUrl)
                        .size(112, 112)
                        .diskCachePolicy(coil.request.CachePolicy.ENABLED)
                        .memoryCachePolicy(coil.request.CachePolicy.ENABLED)
                        .crossfade(false)
                        .build()
                }
                AsyncImage(
                    model = iconRequest,
                    contentDescription = item.app.name,
                    modifier = Modifier
                        .size(56.dp)
                        .clip(RoundedCornerShape(12.dp)),
                    contentScale = ContentScale.Crop
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Android,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onPrimaryContainer,
                        modifier = Modifier.size(32.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.app.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "v${item.installedInfo.versionName} → v${item.app.latestVersionName}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = item.app.formattedSize,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            when (val dlState = item.downloadState) {
                is DownloadState.Downloading -> {
                    CircularProgressIndicator(
                        progress = {
                            if (dlState.progress > 0) dlState.progress / 100f else 0f
                        },
                        modifier = Modifier.size(36.dp),
                        color = InstallGreenLight
                    )
                }

                DownloadState.Installing -> {
                    Text(
                        text = "Installing...",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold
                    )
                }

                else -> {
                    Button(
                        onClick = onUpdateClick,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = InstallGreenLight
                        ),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Text(
                            text = "UPDATE",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        // Live progress bar if downloading
        if (item.downloadState is DownloadState.Downloading) {
            val dl = item.downloadState
            Spacer(modifier = Modifier.height(8.dp))
            if (dl.progress >= 0) {
                LinearProgressIndicator(
                    progress = { dl.progress / 100f },
                    modifier = Modifier.fillMaxWidth(),
                    color = InstallGreenLight
                )
                Text(
                    text = "${dl.progress}% downloaded",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline,
                    modifier = Modifier.padding(top = 2.dp)
                )
            } else {
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth(),
                    color = InstallGreenLight
                )
            }
        }
    }
}

@Composable
private fun UpToDateAppRow(
    item: UpdatableAppItem,
    onAppClick: () -> Unit,
    onOpenClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onAppClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (item.app.iconUrl.isNotBlank()) {
            val context = LocalContext.current
            val iconRequest = remember(item.app.iconUrl) {
                ImageRequest.Builder(context)
                    .data(item.app.iconUrl)
                    .size(88, 88)
                    .diskCachePolicy(coil.request.CachePolicy.ENABLED)
                    .memoryCachePolicy(coil.request.CachePolicy.ENABLED)
                    .crossfade(false)
                    .build()
            }
            AsyncImage(
                model = iconRequest,
                contentDescription = item.app.name,
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(10.dp)),
                contentScale = ContentScale.Crop
            )
        } else {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Android,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.size(24.dp)
                )
            }
        }

        Spacer(modifier = Modifier.width(16.dp))

        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = item.app.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
                Spacer(modifier = Modifier.width(6.dp))
                Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = "Up to date",
                    tint = InstallGreenLight,
                    modifier = Modifier.size(16.dp)
                )
            }
            Text(
                text = "v${item.installedInfo.versionName} • ${item.app.packageName}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.outline,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }

        Spacer(modifier = Modifier.width(8.dp))

        OutlinedButton(
            onClick = onOpenClick,
            shape = RoundedCornerShape(16.dp)
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.OpenInNew,
                contentDescription = null,
                modifier = Modifier.size(14.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text("OPEN", style = MaterialTheme.typography.labelMedium)
        }
    }
}

@Composable
private fun DeviceAppRow(
    deviceApp: DeviceAppInfo,
    onAppClick: () -> Unit,
    onOpenClick: () -> Unit
) {
    val context = LocalContext.current
    val appIconDrawable = remember(deviceApp.packageName) {
        try {
            context.packageManager.getApplicationIcon(deviceApp.packageName)
        } catch (_: Exception) {
            null
        }
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onAppClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (appIconDrawable != null) {
            AsyncImage(
                model = appIconDrawable,
                contentDescription = deviceApp.appName,
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(10.dp)),
                contentScale = ContentScale.Crop
            )
        } else {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Android,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(24.dp)
                )
            }
        }

        Spacer(modifier = Modifier.width(16.dp))

        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = deviceApp.appName,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (deviceApp.matchingStoreApp != null) {
                    Spacer(modifier = Modifier.width(6.dp))
                    Icon(
                        imageVector = Icons.Default.Verified,
                        contentDescription = "Store App",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(15.dp)
                    )
                }
            }
            Text(
                text = "v${deviceApp.versionName.ifBlank { deviceApp.versionCode.toString() }} • ${deviceApp.packageName}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }

        Spacer(modifier = Modifier.width(8.dp))

        OutlinedButton(
            onClick = onOpenClick,
            shape = RoundedCornerShape(16.dp)
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.OpenInNew,
                contentDescription = null,
                modifier = Modifier.size(14.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text("OPEN", style = MaterialTheme.typography.labelMedium)
        }
    }
}
