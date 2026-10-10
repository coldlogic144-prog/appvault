package com.mmmut.appstore.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import coil.compose.AsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest

@Composable
fun ScreenshotsGallery(
    screenshots: List<String>,
    modifier: Modifier = Modifier
) {
    if (screenshots.isEmpty()) return

    var selectedImageForPreview by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current

    LazyRow(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(screenshots, key = { it }) { url ->
            val thumbnailRequest = remember(url) {
                ImageRequest.Builder(context)
                    .data(url)
                    .size(320, 560) // Constrain thumbnail decode resolution for low-RAM devices
                    .diskCachePolicy(CachePolicy.ENABLED)
                    .memoryCachePolicy(CachePolicy.ENABLED)
                    .crossfade(false)
                    .build()
            }

            AsyncImage(
                model = thumbnailRequest,
                contentDescription = "Screenshot preview",
                modifier = Modifier
                    .width(160.dp)
                    .height(280.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .clickable { selectedImageForPreview = url },
                contentScale = ContentScale.Crop
            )
        }
    }

    selectedImageForPreview?.let { previewUrl ->
        Dialog(onDismissRequest = { selectedImageForPreview = null }) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxSize(0.9f)
            ) {
                Box(modifier = Modifier.fillMaxSize()) {
                    val fullRequest = remember(previewUrl) {
                        ImageRequest.Builder(context)
                            .data(previewUrl)
                            .diskCachePolicy(CachePolicy.ENABLED)
                            .memoryCachePolicy(CachePolicy.ENABLED)
                            .crossfade(true)
                            .build()
                    }

                    AsyncImage(
                        model = fullRequest,
                        contentDescription = "Enlarged screenshot",
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(RoundedCornerShape(16.dp)),
                        contentScale = ContentScale.Fit
                    )
                }
            }
        }
    }
}

