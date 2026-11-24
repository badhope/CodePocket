import java.io.FileInputStream
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    // Kotlin 2.0 起，Compose 编译器不再由 kotlinCompilerExtensionVersion 指定，
    // 而是作为独立的 Kotlin 编译器插件引入（K2 编译器）。
    alias(libs.plugins.kotlin.compose)
}

val keystoreProperties = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) FileInputStream(file).use { load(it) }
}
val hasReleaseKeystore = keystoreProperties.getProperty("storeFile")
    ?.let { rootProject.file(it).exists() || file(it).exists() } == true

android {
    namespace = "com.devterminal"
    compileSdk = libs.versions.compileSdk.get().toInt()

    defaultConfig {
        applicationId = "com.devterminal"
        minSdk = libs.versions.minSdk.get().toInt()
        targetSdk = libs.versions.targetSdk.get().toInt()
        versionCode = 27
        versionName = "0.0.27"
        vectorDrawables { useSupportLibrary = true }
        // 原生 CPython 引擎：同时打 arm64 与 x86_64（后者用于模拟器/ChromeOS）
        ndk { abiFilters += listOf("arm64-v8a", "x86_64") }
    }

    // 原生 CPython（PEP 738）：jniLibs 里的 libpython3.13.so / libpybridge.so
    // 由 NDK clang 手动编译后放入 src/main/jniLibs/arm64-v8a，不走 externalNativeBuild，
    // 避免构建机下载 CMake 的不确定性
    ndkVersion = "27.3.13750724"

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            // R8 压缩 DEX：debug 包 95MB 里 classes.dex 约 44MB，release 必须收缩
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // 有 keystore.properties 时用正式签名；没有时退回 debug，保证 CI/新克隆能构建
            signingConfig = if (hasReleaseKeystore) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // language-textmate 依赖 java.time 等需要 core desugaring
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            // SoraEditor 为 LGPL，排除其许可文件避免打包冲突（许可随源码提供）
            excludes += "/META-INF/{AL2.0,LGPL2.1,license/*}"
        }
        // ⚠ 关键：python-stdlib.zip 若被 APK 再压缩，运行时解压/读取会失败，
        // 必须原样存储（noCompress）。wasm 资产已随 Pyodide 方案一并移除。
        jniLibs { useLegacyPackaging = true }
    }

    // 让 assets 里的 python-stdlib.zip 原样打包，不被 AAPT 压缩
    androidResources {
        noCompress += listOf("zip")
    }
}

dependencies {
    // core library desugaring（language-textmate 需要 java.time 等 API 脱糖）
    coreLibraryDesugaring(libs.desugar.jdk.libs)

    // Compose：版本由 BOM 统一约束
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons.extended)

    // AndroidX 基础
    implementation(libs.androidx.core.ktx)
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)

    // ===== 代码编辑器：SoraEditor (LGPL-2.1) =====
    // 若产品闭源，需保证用户可替换该库（动态链接 + 提供目标文件）。
    implementation(libs.sora.editor)
    implementation(libs.sora.editor.language.java)
    implementation(libs.sora.editor.language.textmate)

    // ===== WebView 本地资源加载（Markdown/HTML 预览的 WebView 兼容层） =====
    implementation(libs.androidx.webkit)

    // ===== 敏感配置加密存储（AI Key / Git token）：AndroidX Security + Keystore =====
    implementation(libs.androidx.security.crypto)

    // ===== Git：JGit（纯 Java，恢复完整 Git 能力，同样离线） =====
    implementation(libs.jgit)
    implementation(libs.slf4j.nop)

    // ===== Markdown 解析：实时预览用（纯 Kotlin，GFM 方言） =====
    implementation(libs.intellij.markdown)

    // ===== 纯 Java 运行时：Rhino (JS) / LuaJ (Lua)，无 native/16KB =====
    implementation(libs.rhino)
    implementation(libs.luaj)

    // 单元测试：纯 JVM 逻辑（如报错行解析）不依赖 Android 框架，可直接跑
    testImplementation(libs.junit)
    // Android 的 org.json 在 JVM 单测里是 stub；补一份真实实现给 AgentDecisionParser 测试
    testImplementation("org.json:json:20240303")
}
