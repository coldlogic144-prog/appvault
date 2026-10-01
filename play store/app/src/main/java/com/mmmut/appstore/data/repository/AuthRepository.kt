package com.mmmut.appstore.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class AuthRepository(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore
) {
    private val scope = CoroutineScope(Dispatchers.IO)

    private val _currentUser = MutableStateFlow<FirebaseUser?>(auth.currentUser)
    val currentUser: StateFlow<FirebaseUser?> = _currentUser.asStateFlow()

    private val _isAdmin = MutableStateFlow(false)
    val isAdmin: StateFlow<Boolean> = _isAdmin.asStateFlow()

    init {
        auth.addAuthStateListener { firebaseAuth ->
            val user = firebaseAuth.currentUser
            _currentUser.value = user
            if (user != null) {
                scope.launch {
                    _isAdmin.value = verifyAdminPrivileges(user, forceRefresh = true)
                }
            } else {
                _isAdmin.value = false
            }
        }
    }

    /**
     * Authenticates with Email & Password.
     * Returns true if user is confirmed to have administrator privileges.
     */
    suspend fun signInWithEmail(email: String, password: String): Result<Boolean> {
        return try {
            val authResult = auth.signInWithEmailAndPassword(email.trim(), password).await()
            val user = authResult.user ?: return Result.failure(Exception("Authentication failed"))
            val adminStatus = verifyAdminPrivileges(user, forceRefresh = true)
            _isAdmin.value = adminStatus
            Result.success(adminStatus)
        } catch (e: Exception) {
            _isAdmin.value = false
            Result.failure(e)
        }
    }

    fun signOut() {
        auth.signOut()
        _currentUser.value = null
        _isAdmin.value = false
    }

    suspend fun refreshAdminStatus(): Boolean {
        val user = auth.currentUser ?: run {
            _isAdmin.value = false
            return false
        }
        val adminStatus = verifyAdminPrivileges(user, forceRefresh = true)
        _isAdmin.value = adminStatus
        return adminStatus
    }

    /**
     * Verifies administrator privileges:
     * 1. Checks Firebase Auth custom token claim: `tokenResult.claims["admin"] == true`
     * 2. Checks Firestore protected document: `/admins/{uid}`
     * If neither exists, access is DENIED.
     */
    private suspend fun verifyAdminPrivileges(
        user: FirebaseUser,
        forceRefresh: Boolean = false
    ): Boolean {
        return try {
            // Check 1: Custom Claims on ID token
            val tokenResult = user.getIdToken(forceRefresh).await()
            val claimAdmin = tokenResult.claims["admin"]
            val hasCustomClaim = claimAdmin == true || claimAdmin == "true"
            if (hasCustomClaim) return true

            // Check 2: Secure Firestore admins collection
            val adminDoc = firestore.collection("admins").document(user.uid).get().await()
            val existsInAdmins = adminDoc.exists() && (adminDoc.getString("role") == "admin" || adminDoc.getBoolean("admin") == true)
            existsInAdmins
        } catch (e: Exception) {
            false
        }
    }
}
