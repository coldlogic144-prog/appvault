package com.mmmut.appstore.ui.admin

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AddPhotoAlternate
import androidx.compose.material.icons.filled.Android
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.mmmut.appstore.data.model.AppItem
import com.mmmut.appstore.data.model.Category
import com.mmmut.appstore.data.model.UploadState
import com.mmmut.appstore.data.repository.AppRepository
import com.mmmut.appstore.data.repository.StorageRepository
import com.mmmut.appstore.ui.components.LoadingView
import kotlinx.coroutines.launch

private val PACKAGE_NAME_REGEX = Regex("^[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z][a-zA-Z0-9_]*)+$")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminCreateEditAppScreen(
    appId: String?,
    appRepository: AppRepository,
    storageRepository: StorageRepository,
    onSuccess: () -> Unit,
    onBackClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    var isLoadingApp by remember { mutableStateOf(appId != null) }
    var isSaving by remember { mutableStateOf(false) }

    var name by remember { mutableStateOf("") }
    var packageName by remember { mutableStateOf("") }
    var developer by remember { mutableStateOf("MMMUT Team") }
    var shortDescription by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var categoryId by remember { mutableStateOf("education") }
    var iconUrl by remember { mutableStateOf("") }
    var screenshots by remember { mutableStateOf<List<String>>(emptyList()) }
    var featured by remember { mutableStateOf(false) }
    var published by remember { mutableStateOf(true) }

    // Upload progress states
    var iconUploadState by remember { mutableStateOf<UploadState>(UploadState.Idle) }
    var screenshotUploadState by remember { mutableStateOf<UploadState>(UploadState.Idle) }

    var categoryDropdownExpanded by remember { mutableStateOf(false) }

    // Validation errors
    var nameError by remember { mutableStateOf<String?>(null) }
    var packageNameError by remember { mutableStateOf<String?>(null) }
    var descriptionError by remember { mutableStateOf<String?>(null) }

    // Temporary working appId (for Storage directory paths)
    val workingAppId = remember(appId) {
        appId ?: "app_${System.currentTimeMillis()}"
    }

    // Load existing app if editing
    LaunchedEffect(appId) {
        if (appId != null) {
            appRepository.getAppDetails(appId).collect { result ->
                isLoadingApp = false
                val existing = result.getOrNull()
                if (existing != null) {
                    name = existing.name
                    packageName = existing.packageName
                    developer = existing.developer
                    shortDescription = existing.shortDescription
                    description = existing.description
                    categoryId = existing.categoryId
                    iconUrl = existing.iconUrl
                    screenshots = existing.screenshots
                    featured = existing.featured
                    published = existing.published
                }
            }
        }
    }

    // Photo pickers
    val iconPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            coroutineScope.launch {
                storageRepository.uploadAppIcon(workingAppId, uri).collect { state ->
                    iconUploadState = state
                    if (state is UploadState.Success) {
                        iconUrl = state.downloadUrl
                    }
                }
            }
        }
    }

    val screenshotPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetMultipleContents()
    ) { uris: List<Uri> ->
        if (uris.isNotEmpty()) {
            coroutineScope.launch {
                for (uri in uris) {
                    storageRepository.uploadScreenshot(workingAppId, uri).collect { state ->
                        screenshotUploadState = state
                        if (state is UploadState.Success) {
                            screenshots = screenshots + state.downloadUrl
                        }
                    }
                }
            }
        }
    }

    fun validate(): Boolean {
        var valid = true

        if (name.isBlank()) {
            nameError = "Application name cannot be empty"
            valid = false
        } else {
            nameError = null
        }

        if (packageName.isBlank()) {
            packageNameError = "Package name cannot be empty"
            valid = false
        } else if (!PACKAGE_NAME_REGEX.matches(packageName)) {
            packageNameError = "Invalid package name format (e.g. com.company.app)"
            valid = false
        } else {
            packageNameError = null
        }

        if (description.isBlank() && shortDescription.isBlank()) {
            descriptionError = "Please provide at least a short description"
            valid = false
        } else {
            descriptionError = null
        }

        return valid
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text(if (appId != null) "Edit Application" else "New Application") },
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
        if (isLoadingApp) {
            LoadingView(message = "Loading application data...")
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Application Name
                OutlinedTextField(
                    value = name,
                    onValueChange = {
                        name = it
                        if (nameError != null) nameError = null
                    },
                    label = { Text("Application Name *") },
                    isError = nameError != null,
                    supportingText = nameError?.let { { Text(it) } },
                    modifier = Modifier.fillMaxWidth()
                )

                // Package Name
                OutlinedTextField(
                    value = packageName,
                    onValueChange = {
                        packageName = it.trim()
                        if (packageNameError != null) packageNameError = null
                    },
                    label = { Text("Package Name (e.g. com.mmmut.erp) *") },
                    isError = packageNameError != null,
                    supportingText = packageNameError?.let { { Text(it) } },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = appId == null // Lock package name on edit to maintain update integrity
                )

                // Developer Name
                OutlinedTextField(
                    value = developer,
                    onValueChange = { developer = it },
                    label = { Text("Developer / Publisher Name *") },
                    modifier = Modifier.fillMaxWidth()
                )

                // Category Dropdown
                ExposedDropdownMenuBox(
                    expanded = categoryDropdownExpanded,
                    onExpandedChange = { categoryDropdownExpanded = !categoryDropdownExpanded }
                ) {
                    OutlinedTextField(
                        value = Category.DEFAULT_CATEGORIES.find { it.id == categoryId }?.name ?: categoryId,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Category") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryDropdownExpanded) },
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth()
                    )
                    ExposedDropdownMenu(
                        expanded = categoryDropdownExpanded,
                        onDismissRequest = { categoryDropdownExpanded = false }
                    ) {
                        Category.DEFAULT_CATEGORIES.filter { it.id != "all" }.forEach { cat ->
                            DropdownMenuItem(
                                text = { Text(cat.name) },
                                onClick = {
                                    categoryId = cat.id
                                    categoryDropdownExpanded = false
                                }
                            )
                        }
                    }
                }

                // Short Description
                OutlinedTextField(
                    value = shortDescription,
                    onValueChange = { shortDescription = it },
                    label = { Text("Short Description") },
                    placeholder = { Text("Single-sentence summary of the app") },
                    modifier = Modifier.fillMaxWidth()
                )

                // Full Description
                OutlinedTextField(
                    value = description,
                    onValueChange = {
                        description = it
                        if (descriptionError != null) descriptionError = null
                    },
                    label = { Text("Full Description *") },
                    minLines = 4,
                    isError = descriptionError != null,
                    supportingText = descriptionError?.let { { Text(it) } },
                    modifier = Modifier.fillMaxWidth()
                )

                // Icon Picker & Preview
                Text(
                    text = "Application Icon",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    if (iconUrl.isNotBlank()) {
                        AsyncImage(
                            model = iconUrl,
                            contentDescription = "Icon preview",
                            modifier = Modifier
                                .size(72.dp)
                                .clip(RoundedCornerShape(16.dp)),
                            contentScale = ContentScale.Crop
                        )
                    } else {
                        Box(
                            modifier = Modifier
                                .size(72.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Android, contentDescription = null, modifier = Modifier.size(36.dp))
                        }
                    }

                    Column {
                        OutlinedButton(
                            onClick = { iconPickerLauncher.launch("image/*") }
                        ) {
                            Icon(Icons.Default.Image, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Choose Icon Image")
                        }

                        if (iconUploadState is UploadState.Uploading) {
                            val up = iconUploadState as UploadState.Uploading
                            Spacer(modifier = Modifier.height(4.dp))
                            LinearProgressIndicator(
                                progress = { up.progress / 100f },
                                modifier = Modifier.width(160.dp)
                            )
                            Text(up.message, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }

                // Screenshots Picker & Preview Gallery
                Text(
                    text = "Screenshots (${screenshots.size})",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )

                OutlinedButton(
                    onClick = { screenshotPickerLauncher.launch("image/*") }
                ) {
                    Icon(Icons.Default.AddPhotoAlternate, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Add Screenshots")
                }

                if (screenshotUploadState is UploadState.Uploading) {
                    val up = screenshotUploadState as UploadState.Uploading
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                    Text(up.message, style = MaterialTheme.typography.labelSmall)
                }

                if (screenshots.isNotEmpty()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        screenshots.forEachIndexed { index, url ->
                            Box {
                                AsyncImage(
                                    model = url,
                                    contentDescription = "Screenshot $index",
                                    modifier = Modifier
                                        .width(100.dp)
                                        .height(180.dp)
                                        .clip(RoundedCornerShape(8.dp)),
                                    contentScale = ContentScale.Crop
                                )
                                IconButton(
                                    onClick = {
                                        screenshots = screenshots.filterIndexed { i, _ -> i != index }
                                    },
                                    modifier = Modifier
                                        .align(Alignment.TopEnd)
                                        .size(28.dp)
                                        .background(
                                            MaterialTheme.colorScheme.surface.copy(alpha = 0.8f),
                                            RoundedCornerShape(14.dp)
                                        )
                                ) {
                                    Icon(Icons.Default.Close, contentDescription = "Remove", modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    }
                }

                // Featured Switch
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Featured Application",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = "Displays on the home screen hero banner",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Switch(
                        checked = featured,
                        onCheckedChange = { featured = it }
                    )
                }

                // Published Switch
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
                            text = "If disabled, app remains as draft visible only to admins",
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

                // Save Button
                Button(
                    onClick = {
                        if (!validate()) return@Button
                        isSaving = true
                        coroutineScope.launch {
                            val appToSave = AppItem(
                                id = appId ?: workingAppId,
                                name = name.trim(),
                                packageName = packageName.trim(),
                                slug = name.trim().lowercase().replace("\\s+".toRegex(), "-"),
                                shortDescription = shortDescription.trim(),
                                description = description.trim(),
                                developer = developer.trim(),
                                categoryId = categoryId,
                                iconUrl = iconUrl,
                                screenshots = screenshots,
                                featured = featured,
                                published = published
                            )

                            val result = if (appId != null) {
                                appRepository.updateApp(appToSave)
                            } else {
                                appRepository.createApp(appToSave)
                            }

                            isSaving = false
                            result.fold(
                                onSuccess = {
                                    onSuccess()
                                },
                                onFailure = { error ->
                                    snackbarHostState.showSnackbar("Save failed: ${error.localizedMessage}")
                                }
                            )
                        }
                    },
                    enabled = !isSaving,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    shape = RoundedCornerShape(24.dp)
                ) {
                    if (isSaving) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                    } else {
                        Icon(Icons.Default.Check, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(if (appId != null) "Save Changes" else "Create Application")
                    }
                }
            }
        }
    }
}
