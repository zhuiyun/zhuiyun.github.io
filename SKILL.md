---
name: android-16-migration
description: Audit and migrate Android View or Compose apps for Android 16/API 36 using official Android guidance. Use when setting up the Android 16 SDK, moving compileSdk or targetSdk to 36, reviewing Android 16 behavior changes, validating edge-to-edge or predictive back, checking large-screen/adaptive layout impacts, or planning a safe migration.
---

# Android 16 Migration

## Overview

Use this skill to migrate an Android app toward Android 16/API 36 with the official Android documentation as the source of truth. The workflow separates compatibility testing from targetSdk changes so the app can keep existing behavior while risks are found and fixed deliberately.

## Source Priority

- Prefer official Android Developers documentation. If the user asks for latest/current guidance, or if the docs are not already in context, browse the official Android pages before making migration claims.
- Load `references/official-docs.md` when you need the Android 16 checklist or source links.
- For edge-to-edge and predictive back implementation details in Android View-based projects, also use the `adapt-android-edge-back` skill when it is available and relevant.

## Migration Workflow

1. Inspect the project before editing.
   - Identify modules, AGP version, Gradle wrapper, Kotlin version, Java compatibility, compileSdk, targetSdk, minSdk, AppCompat/AndroidX Activity versions, Hilt/KSP/KAPT versions, manifest flags, themes, base activities, and any native `.so` usage.
   - Search for Android 16 risk points with `rg`: `targetSdk`, `compileSdk`, `windowOptOutEdgeToEdgeEnforcement`, `fitsSystemWindows`, `onBackPressed`, `onKeyDown`, `KEYCODE_BACK`, `enableOnBackInvokedCallback`, `screenOrientation`, `resizeableActivity`, `minAspectRatio`, `maxAspectRatio`, `setRequestedOrientation`, `DialogFragment`, `Dialog`, `Gravity.BOTTOM`, `getDialogHeightRatio`, `Window#setLayout`, `setDecorFitsSystemWindows`, `JobScheduler`, `WorkManager`, `DownloadManager`, `announceForAccessibility`, `BODY_SENSORS`, `MediaStore.getVersion`, `intentMatchingFlags`, `removeLaunchSecurityProtection`, and native library packaging.

2. Do compatibility testing first.
   - Follow the official migration order: test the current published/current-target app on Android 16 first, review behavior changes for all apps, and make only required compatibility fixes before changing targetSdk.
   - Do not bump targetSdk just to prove compatibility. Keep changes minimal until the app is ready for Android 16 runtime behaviors.

3. Prepare Android 16 SDK/build support.
   - Android 16 APIs use `compileSdk = 36`.
   - Move to `targetSdk = 36` only when the team is ready to opt in to Android 16 target-specific behavior changes.
   - Official setup guidance requires Android Studio Meerkat 2024.3.1 or higher for the best Android 16 SDK experience and AGP 8.9.0-rc01 or higher before using the Android 16 SDK.
   - Align AGP, Kotlin, Hilt, KSP/KAPT, and AndroidX conservatively. Prefer compatible versions already proven by the repo; do not blindly upgrade unrelated dependencies.

4. Handle targetSdk 36 behavior changes.
   - Edge-to-edge: `windowOptOutEdgeToEdgeEnforcement` is disabled for Android 16-targeting apps on Android 16. Remove opt-out assumptions and handle system bar insets in code/layouts. Audit bottom sheets and bottom `DialogFragment`/`Dialog` windows too: full-height bottom dialogs (`Gravity.BOTTOM` with `MATCH_PARENT`, `-1f`, or height ratio `1f`) need status bar/display cutout top inset as well as navigation bar bottom inset; half-height bottom dialogs usually need bottom inset only.
   - Predictive back: for targetSdk 36 on Android 16, system predictive back animations are enabled by default; `onBackPressed` is not called and `KEYCODE_BACK` is not dispatched for intercepted system back. Use supported AndroidX back APIs and preserve existing app back logic behind a clear local entry point.
   - Large screens/adaptive layout: for displays with smallest width >= 600dp, Android 16 can ignore orientation, resizability, and aspect-ratio restrictions for targetSdk 36 apps. Audit locked-orientation flows and state restoration.
   - Other targeted areas: fixed-rate scheduled executors, elegant font/text layout behavior, health sensor permissions, Bluetooth bond/encryption changes, `MediaStore#getVersion`, and safer intent matching. Apply only when the app uses the affected API or behavior.

5. Handle all-app Android 16 behavior changes.
   - Audit background jobs and downloads affected by JobScheduler quota changes, including WorkManager, JobScheduler, and DownloadManager usage.
   - Check abandoned JobScheduler jobs and deprecated `JobInfo#setImportantWhileForeground` assumptions.
   - Review ordered broadcast priority assumptions across processes.
   - Avoid ART internals and restricted non-SDK APIs; replace them with public SDK/NDK APIs when possible.
   - For native code or bundled `.so` files, check 16 KB page-size readiness even though Android 16 includes compatibility mode.
   - Review accessibility announcements, virtual-device/large-display projection behavior, intent redirection hardening, Companion Device Manager discovery timeout behavior, and Bluetooth pairing-loss behavior if the app uses those surfaces.

6. Implement with local patterns.
   - Prefer the repo's base Activity, DialogFragment/Dialog base classes, navigation, theme, and inset helpers over one-off fixes. For bottom dialog bases, keep the default path bottom-only, but add an opt-in or automatic top inset for full-height bottom dialogs so controls do not sit under the status bar.
   - Preserve existing back/finish/business logic while moving entry points to supported AndroidX APIs.
   - Keep edits scoped. Do not revert user changes or refactor unrelated code.
   - Avoid temporary Android 16 opt-outs unless the user explicitly asks for a staged migration; clearly report any opt-out and its removal path.

7. Validate and report.
   - Run the narrowest meaningful Gradle task first, then the app build, for example `./gradlew :app:assembleDebug` or `./gradlew.bat :app:assembleDebug` on Windows.
   - Run lint/unit tests/instrumented Android 16 emulator checks when available and relevant.
   - Report exact files changed, commands run, pass/fail status, tests not run, and remaining Android 16 risks.

## Output Expectations

- Start with the decision: compatibility-only, compileSdk 36, or targetSdk 36 migration.
- List high-risk Android 16 findings before low-risk cleanup.
- When editing, explain how existing behavior was preserved.
- Include source links when the user asked for official guidance or when a claim depends on current Android docs.
