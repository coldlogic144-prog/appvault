# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in C:\Users\Tanish\AppData\Local\Android\Sdk/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.kts.

-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-dontwarn javax.annotation.**

# Firebase Models (keep data classes for Firestore serialization)
-keepclassmembers class com.mmmut.appstore.data.model.** {
    <fields>;
    <init>(...);
}
-keep class com.mmmut.appstore.data.model.** { *; }
