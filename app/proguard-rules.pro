# JNI：C 侧按方法名/签名查找回调，不能被 R8 改名或裁剪
-keep class com.devterminal.engine.NativeBridge { *; }
-keep class com.devterminal.engine.NativeEngine { *; }
-keepclasseswithmembernames class * { native <methods>; }

# Git / JS / Lua / 编辑器：大量反射与动态类加载
-keep class org.eclipse.jgit.** { *; }
-dontwarn org.eclipse.jgit.**
-keep class org.mozilla.javascript.* { *; }
-keep class org.mozilla.javascript.annotations.** { *; }
-dontwarn org.mozilla.javascript.tools.**
-dontwarn javax.swing.**
-dontwarn java.awt.**
-dontwarn kotlin.Cloneable$DefaultImpls
-dontwarn java.beans.**
-dontwarn javax.annotation.**
-dontwarn javax.script.**
-keep class org.luaj.vm2.* { *; }
-keep class org.luaj.vm2.lib.** { *; }
-keep class org.luaj.vm2.compiler.** { *; }
-dontwarn org.apache.bcel.**
-dontwarn org.luaj.vm2.luajc.**
-keep class io.github.rosemoe.sora.** { *; }
-keep class org.eclipse.tm4e.** { *; }
-dontwarn org.eclipse.tm4e.**

# 保留行号，崩溃栈仍可定位
-keepattributes SourceFile,LineNumberTable

# llama.cpp JNI：LocalLlama 的 native 方法按名字查找，必须保留类名与方法名
-keep class com.devterminal.model.LocalLlama { *; }
