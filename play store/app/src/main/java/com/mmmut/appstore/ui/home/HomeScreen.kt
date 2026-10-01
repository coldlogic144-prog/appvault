package com.mmmut.appstore.ui.home

import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.mmmut.appstore.ui.components.AppListItem
import com.mmmut.appstore.ui.components.AppMiniCard
import com.mmmut.appstore.ui.components.CategoryChipRow
import com.mmmut.appstore.ui.components.EmptyStateView
import com.mmmut.appstore.ui.components.ErrorStateView
import com.mmmut.appstore.ui.components.FeaturedAppCard
import com.mmmut.appstore.ui.components.LoadingView
import com.mmmut.appstore.ui.components.OfflineBanner
import com.mmmut.appstore.ui.components.SectionHeader

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    viewModel: HomeViewModel,
    onAppClick: (String) -> Unit,
    onNavigateToApps: (String?) -> Unit,
    modifier: Modifier = Modifier
) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "AppVault",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "My Personal Store",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
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
            // Offline banner
            OfflineBanner(
                isOnline = state.isOnline,
                onRetry = { viewModel.loadData() }
            )

            // Category chips
            CategoryChipRow(
                categories = state.categories,
                selectedCategoryId = state.selectedCategoryId,
                onCategorySelected = { categoryId ->
                    viewModel.selectCategory(categoryId)
                }
            )

            when {
                state.isLoading -> {
                    LoadingView(message = "Loading store catalogue...")
                }

                state.errorMessage != null && state.allApps.isEmpty() -> {
                    ErrorStateView(
                        message = state.errorMessage ?: "Unknown error",
                        onRetry = { viewModel.loadData() }
                    )
                }

                state.featuredApps.isEmpty() && state.allApps.isEmpty() -> {
                    EmptyStateView(
                        icon = Icons.Default.Storefront,
                        title = "No Apps in Store",
                        message = "No published apps found in Firebase. Publish your first app through the Admin Panel in Settings.",
                        actionText = "Refresh Catalogue",
                        onActionClick = { viewModel.loadData() }
                    )
                }

                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 24.dp)
                    ) {
                        // 1. Featured Apps
                        if (state.featuredApps.isNotEmpty()) {
                            item {
                                SectionHeader(title = "Featured")
                                Column(
                                    modifier = Modifier.padding(horizontal = 16.dp),
                                    verticalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    state.featuredApps.forEach { app ->
                                        FeaturedAppCard(
                                            app = app,
                                            onClick = { onAppClick(app.id) }
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(16.dp))
                            }
                        }

                        // 2. Recently Added
                        if (state.recentlyAddedApps.isNotEmpty()) {
                            item {
                                SectionHeader(
                                    title = "Recently Added",
                                    actionText = "See all",
                                    onActionClick = { onNavigateToApps(null) }
                                )
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .horizontalScroll(rememberScrollState())
                                        .padding(horizontal = 16.dp),
                                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    state.recentlyAddedApps.forEach { app ->
                                        AppMiniCard(
                                            app = app,
                                            onClick = { onAppClick(app.id) }
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(16.dp))
                            }
                        }

                        // 3. Recently Updated
                        if (state.recentlyUpdatedApps.isNotEmpty()) {
                            item {
                                SectionHeader(
                                    title = "Recently Updated",
                                    actionText = "See all",
                                    onActionClick = { onNavigateToApps(null) }
                                )
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .horizontalScroll(rememberScrollState())
                                        .padding(horizontal = 16.dp),
                                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    state.recentlyUpdatedApps.forEach { app ->
                                        AppMiniCard(
                                            app = app,
                                            onClick = { onAppClick(app.id) }
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(16.dp))
                            }
                        }

                        // 4. All Apps Section
                        item {
                            SectionHeader(title = "All Applications")
                        }

                        items(state.allApps, key = { it.id }) { app ->
                            AppListItem(
                                app = app,
                                onClick = { onAppClick(app.id) }
                            )
                            HorizontalDivider(
                                modifier = Modifier.padding(horizontal = 16.dp),
                                color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
                            )
                        }
                    }
                }
            }
        }
    }
}
