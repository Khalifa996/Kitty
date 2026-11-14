# Android build 53 (276035bfc37c3e34b8bc2390444600d263defc57)
bootstrap=success deps=success install=success typecheck=success tests=success shots=success prebuild=success gradle=success

## bootstrap (last 150 lines)
```
Already set up
```

## deps (last 150 lines)
```
No new packages
```

## install (last 150 lines)
```
npm warn deprecated whatwg-encoding@3.1.1: Use @exodus/bytes instead for a more spec-conformant and faster implementation
npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
npm warn deprecated glob@7.2.3: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
added 1064 packages, and audited 1065 packages in 24s
100 packages are looking for funding
  run `npm fund` for details
28 vulnerabilities (1 low, 25 moderate, 2 high)
To address issues that do not require attention, run:
  npm audit fix
To address all issues (including breaking changes), run:
  npm audit fix --force
Run `npm audit` for details.
expo 58.0.19, react-native 0.88.0
```

## typecheck (last 150 lines)
```
```

## tests (last 150 lines)
```
PASS src/parse/bankAlerts.test.ts
PASS src/engine/budget.test.ts
PASS src/capture/toEntry.test.ts
PASS src/engine/spending.test.ts
PASS src/brain/brain.test.ts
PASS src/engine/bills.test.ts
PASS src/engine/checks.test.ts
PASS src/engine/forecast.test.ts
PASS src/engine/setup.test.ts
PASS src/engine/picks.test.ts
PASS src/ai/ask.test.ts
PASS src/engine/debts.test.ts
PASS src/engine/morning.test.ts
PASS src/ai/redact.test.ts
Test Suites: 14 passed, 14 total
Tests:       161 passed, 161 total
Snapshots:   0 total
Time:        4.247 s
Ran all test suites.
```

## web (last 150 lines)
```
Starting Metro Bundler
Web Bundled 13657ms index.ts (412 modules)
› web bundles (1):
_expo/static/js/web/index-4e2d2408a3e424b83178ce3777433593.js (917KB)
› Files (2):
index.html (1.2KB)
metadata.json (49B)
Exported: /tmp/web
screenshots done; errors: none
```

## prebuild (last 150 lines)
```
- Creating native directory (./android)
✔ Created native directory
- Updating package.json
✔ Updated package.json
- Running prebuild
» android: userInterfaceStyle: Install expo-system-ui in your project to enable this feature.
- Running prebuild
✔ Finished prebuild
```

## gradle (last 150 lines)
```
w: file:///home/runner/work/Kitty/Kitty/mobile/node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/types/JSTypeConverter.kt:245:55 'class NativeArrayBuffer : Destructible' is deprecated. Use ArrayBuffer instead.
w: file:///home/runner/work/Kitty/Kitty/mobile/node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/types/JSTypeConverter.kt:247:19 'class NativeArrayBuffer : Destructible' is deprecated. Use ArrayBuffer instead.
w: file:///home/runner/work/Kitty/Kitty/mobile/node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/types/ReturnType.kt:6:8 'class NativeArrayBuffer : Destructible' is deprecated. Use ArrayBuffer instead.
w: file:///home/runner/work/Kitty/Kitty/mobile/node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/types/ReturnType.kt:45:5 'class NativeArrayBuffer : Destructible' is deprecated. Use ArrayBuffer instead.
w: file:///home/runner/work/Kitty/Kitty/mobile/node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/types/TypeConverterProvider.kt:19:8 'class NativeArrayBuffer : Destructible' is deprecated. Use ArrayBuffer instead.
w: file:///home/runner/work/Kitty/Kitty/mobile/node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/types/TypeConverterProvider.kt:254:7 'class NativeArrayBuffer : Destructible' is deprecated. Use ArrayBuffer instead.
> Task :expo-modules-core:compileReleaseJavaWithJavac
Note: Some input files use or override a deprecated API.
Note: Recompile with -Xlint:deprecation for details.
> Task :expo-modules-core:mergeReleaseGeneratedProguardFiles
> Task :expo-modules-core:exportReleaseConsumerProguardFiles
> Task :expo-modules-core:processReleaseJavaRes
> Task :expo-modules-core:bundleLibCompileToJarRelease
> Task :expo-modules-core:bundleLibRuntimeToJarRelease
> Task :expo-modules-core:generateReleaseLintModel
> Task :expo-constants:compileReleaseKotlin
> Task :expo-constants:compileReleaseJavaWithJavac NO-SOURCE
> Task :expo-constants:bundleLibCompileToJarRelease
> Task :expo-constants:mergeReleaseGeneratedProguardFiles
> Task :expo-constants:exportReleaseConsumerProguardFiles
> Task :expo-constants:bundleLibRuntimeToJarRelease
> Task :expo-constants:processReleaseJavaRes
> Task :expo-constants:createFullJarRelease
> Task :expo-modules-core:createFullJarRelease
> Task :expo-constants:generateReleaseLintModel
> Task :expo-modules-core:extractReleaseAnnotations
> Task :expo-modules-core:mergeReleaseConsumerProguardFiles
> Task :expo-modules-core:mergeReleaseJavaResource
> Task :expo-log-box:compileReleaseKotlin
> Task :expo-modules-core:syncReleaseLibJars
> Task :expo-modules-core:bundleReleaseLocalLintAar
> Task :expo-constants:extractReleaseAnnotations
> Task :expo-constants:mergeReleaseConsumerProguardFiles
> Task :expo-constants:mergeReleaseJavaResource
> Task :expo-constants:syncReleaseLibJars
> Task :expo-constants:bundleReleaseLocalLintAar
> Task :expo-constants:lintVitalAnalyzeRelease SKIPPED
> Task :expo-modules-core:lintVitalAnalyzeRelease SKIPPED
> Task :expo-constants:generateReleaseLintVitalModel
> Task :expo-modules-core:generateReleaseLintVitalModel
> Task :expo-constants:bundleReleaseAar
> Task :expo-constants:assembleRelease
> Task :expo-dom-webview:compileReleaseKotlin
w: file:///home/runner/work/Kitty/Kitty/mobile/node_modules/@expo/dom-webview/android/src/main/java/expo/modules/webview/DomWebView.kt:200:16 'var allowFileAccessFromFileURLs: Boolean' is deprecated. Deprecated in Java.
w: file:///home/runner/work/Kitty/Kitty/mobile/node_modules/@expo/dom-webview/android/src/main/java/expo/modules/webview/DomWebView.kt:254:18 'fun executeOnJavaScriptThread(runnable: Runnable): Unit' is deprecated. Use RuntimeContext.schedule instead.
> Task :expo-modules-core:bundleReleaseAar
> Task :expo-modules-core:assembleRelease
> Task :expo-dom-webview:compileReleaseJavaWithJavac NO-SOURCE
> Task :expo-dom-webview:mergeReleaseGeneratedProguardFiles
> Task :kitty-notifications:compileReleaseKotlin
w: file:///home/runner/work/Kitty/Kitty/mobile/modules/kitty-notifications/android/src/main/java/expo/modules/kittynotifications/Surfaces.kt:145:9 'fun startActivityAndCollapse(p0: Intent!): Unit' is deprecated. Deprecated in Java.
> Task :kitty-notifications:compileReleaseJavaWithJavac NO-SOURCE
> Task :expo-dom-webview:exportReleaseConsumerProguardFiles
> Task :kitty-notifications:mergeReleaseGeneratedProguardFiles
> Task :expo-dom-webview:bundleLibCompileToJarRelease
> Task :kitty-notifications:exportReleaseConsumerProguardFiles
> Task :expo-dom-webview:bundleLibRuntimeToJarRelease
> Task :kitty-notifications:bundleLibCompileToJarRelease
> Task :expo-dom-webview:processReleaseJavaRes
> Task :kitty-notifications:bundleLibRuntimeToJarRelease
> Task :expo-dom-webview:createFullJarRelease
> Task :kitty-notifications:processReleaseJavaRes
> Task :kitty-notifications:createFullJarRelease
> Task :expo-dom-webview:generateReleaseLintModel
> Task :kitty-notifications:generateReleaseLintModel
> Task :expo-log-box:compileReleaseJavaWithJavac
> Task :expo-log-box:mergeReleaseGeneratedProguardFiles
> Task :expo-dom-webview:extractReleaseAnnotations
> Task :expo-log-box:exportReleaseConsumerProguardFiles
> Task :expo-log-box:bundleLibCompileToJarRelease
> Task :expo-dom-webview:mergeReleaseConsumerProguardFiles
> Task :expo-log-box:bundleLibRuntimeToJarRelease
> Task :expo-log-box:processReleaseJavaRes
> Task :expo-dom-webview:mergeReleaseJavaResource
> Task :expo-log-box:createFullJarRelease
> Task :kitty-notifications:extractReleaseAnnotations
> Task :kitty-notifications:mergeReleaseConsumerProguardFiles
> Task :expo-dom-webview:syncReleaseLibJars
> Task :expo-dom-webview:bundleReleaseLocalLintAar
> Task :expo-dom-webview:lintVitalAnalyzeRelease SKIPPED
> Task :kitty-notifications:lintVitalAnalyzeRelease SKIPPED
> Task :expo-dom-webview:generateReleaseLintVitalModel
> Task :kitty-notifications:mergeReleaseJavaResource
> Task :expo-dom-webview:bundleReleaseAar
> Task :expo-dom-webview:assembleRelease
> Task :kitty-notifications:generateReleaseLintVitalModel
> Task :kitty-notifications:syncReleaseLibJars
> Task :kitty-notifications:bundleReleaseLocalLintAar
> Task :kitty-notifications:bundleReleaseAar
> Task :kitty-notifications:assembleRelease
> Task :expo-log-box:generateReleaseLintModel
> Task :expo-log-box:extractReleaseAnnotations
> Task :expo-log-box:mergeReleaseConsumerProguardFiles
> Task :expo-log-box:lintVitalAnalyzeRelease SKIPPED
> Task :expo-log-box:mergeReleaseJavaResource
> Task :expo-log-box:generateReleaseLintVitalModel
> Task :expo-log-box:syncReleaseLibJars
> Task :expo-log-box:bundleReleaseLocalLintAar
> Task :expo-log-box:bundleReleaseAar
> Task :expo-log-box:assembleRelease
> Task :expo:compileReleaseKotlin
w: file:///home/runner/work/Kitty/Kitty/mobile/node_modules/expo/android/src/main/java/expo/modules/ExpoModulesPackage.kt:34:16 This declaration overrides a deprecated member but is not marked as deprecated itself. Add the '@Deprecated' annotation or suppress the diagnostic.
w: file:///home/runner/work/Kitty/Kitty/mobile/node_modules/expo/android/src/main/java/expo/modules/ReactActivityDelegateWrapper.kt:22:8 'class ReactInstanceManager : Any' is deprecated. Deprecated in Java.
w: file:///home/runner/work/Kitty/Kitty/mobile/node_modules/expo/android/src/main/java/expo/modules/ReactActivityDelegateWrapper.kt:103:16 This declaration overrides a deprecated member but is not marked as deprecated itself. Add the '@Deprecated' annotation or suppress the diagnostic.
w: file:///home/runner/work/Kitty/Kitty/mobile/node_modules/expo/android/src/main/java/expo/modules/ReactActivityDelegateWrapper.kt:103:43 'class ReactInstanceManager : Any' is deprecated. Deprecated in Java.
w: file:///home/runner/work/Kitty/Kitty/mobile/node_modules/expo/android/src/main/java/expo/modules/ReactActivityDelegateWrapper.kt:104:21 'val reactInstanceManager: ReactInstanceManager' is deprecated. Deprecated in Java.
w: file:///home/runner/work/Kitty/Kitty/mobile/node_modules/expo/android/src/main/java/expo/modules/fetch/ExpoFetchModule.kt:15:8 'class NativeArrayBuffer : Destructible' is deprecated. Use ArrayBuffer instead.
w: file:///home/runner/work/Kitty/Kitty/mobile/node_modules/expo/android/src/main/java/expo/modules/fetch/ExpoFetchModule.kt:33:39 'constructor(reactContext: ReactContext): ForwardingCookieHandler' is deprecated. Use the default constructor.
w: file:///home/runner/work/Kitty/Kitty/mobile/node_modules/expo/android/src/main/java/expo/modules/fetch/ExpoFetchModule.kt:111:27 'constructor(byteBuffer: ByteBuffer): NativeArrayBuffer' is deprecated. Use ArrayBuffer instead.
w: file:///home/runner/work/Kitty/Kitty/mobile/node_modules/expo/android/src/main/java/expo/modules/fetch/NativeResponse.kt:44:16 This declaration overrides a deprecated member but is not marked as deprecated itself. Add the '@Deprecated' annotation or suppress the diagnostic.
w: file:///home/runner/work/Kitty/Kitty/mobile/node_modules/expo/android/src/main/java/expo/modules/fetch/NativeResponse.kt:46:11 'fun deallocate(): Unit' is deprecated. Use sharedObjectDidRelease() instead.
> Task :expo:compileReleaseJavaWithJavac NO-SOURCE
> Task :expo:mergeReleaseGeneratedProguardFiles
> Task :expo:exportReleaseConsumerProguardFiles
> Task :expo:bundleLibRuntimeToJarRelease
> Task :expo:bundleLibCompileToJarRelease
> Task :expo:processReleaseJavaRes
> Task :expo:createFullJarRelease
> Task :expo:generateReleaseLintModel
> Task :expo:extractReleaseAnnotations
> Task :expo:mergeReleaseConsumerProguardFiles
> Task :expo:lintVitalAnalyzeRelease SKIPPED
> Task :expo:mergeReleaseJavaResource
> Task :expo:generateReleaseLintVitalModel
> Task :expo:syncReleaseLibJars
> Task :expo:bundleReleaseLocalLintAar
> Task :expo:bundleReleaseAar
> Task :expo:assembleRelease
> Task :app:compileReleaseKotlin
w: file:///home/runner/work/Kitty/Kitty/mobile/android/app/src/main/java/com/khalifa996/kitty/MainActivity.kt:36:20 'constructor(activity: ReactActivity, mainComponentName: String, fabricEnabled: Boolean): DefaultReactActivityDelegate' is deprecated. Creating DefaultReactActivityDelegate with flags is deprecated.
> Task :app:compileReleaseJavaWithJavac
> Task :app:mergeReleaseGeneratedProguardFiles
> Task :app:processReleaseJavaRes
> Task :app:expandReleaseArtProfileWildcards
> Task :app:mergeReleaseJavaResource
> Task :app:generateReleaseLintVitalReportModel
> Task :app:lintVitalAnalyzeRelease
> Task :app:lintVitalReportRelease
> Task :app:lintVitalRelease
> Task :app:minifyReleaseWithR8
> Task :app:compileReleaseArtProfile
> Task :app:packageRelease
> Task :app:createReleaseApkListingFileRedirect
> Task :app:assembleRelease
[Incubating] Problems report is available at: file:///home/runner/work/Kitty/Kitty/mobile/android/build/reports/problems/problems-report.html
Deprecated Gradle features were used in this build, making it incompatible with Gradle 10.
You can use '--warning-mode all' to show the individual deprecation warnings and determine if they come from your own scripts or plugins.
For more on this, please refer to https://docs.gradle.org/9.4.1/userguide/command_line_interface.html#sec:command_line_warnings in the Gradle documentation.
BUILD SUCCESSFUL in 8m 48s
409 actionable tasks: 409 executed
```

## gradle errors
```
268:Note: Some input files use or override a deprecated API.
269:Note: Recompile with -Xlint:deprecation for details.
270:Note: Some input files use unchecked or unsafe operations.
271:Note: Recompile with -Xlint:unchecked for details.
272-
273-> Task :react-native-safe-area-context:javaPreCompileRelease
274-> Task :react-native-svg:mergeReleaseGeneratedProguardFiles
275-> Task :react-native-svg:exportReleaseConsumerProguardFiles
--
563:Note: Some input files use or override a deprecated API.
564:Note: Recompile with -Xlint:deprecation for details.
565-
566-> Task :expo-modules-core:mergeReleaseGeneratedProguardFiles
567-> Task :expo-modules-core:exportReleaseConsumerProguardFiles
568-> Task :expo-modules-core:processReleaseJavaRes
--
602:w: file:///home/runner/work/Kitty/Kitty/mobile/node_modules/@expo/dom-webview/android/src/main/java/expo/modules/webview/DomWebView.kt:254:18 'fun executeOnJavaScriptThread(runnable: Runnable): Unit' is deprecated. Use RuntimeContext.schedule instead.
603-
604-> Task :expo-modules-core:bundleReleaseAar
605-> Task :expo-modules-core:assembleRelease
606-> Task :expo-dom-webview:compileReleaseJavaWithJavac NO-SOURCE
--
693:w: file:///home/runner/work/Kitty/Kitty/mobile/android/app/src/main/java/com/khalifa996/kitty/MainActivity.kt:36:20 'constructor(activity: ReactActivity, mainComponentName: String, fabricEnabled: Boolean): DefaultReactActivityDelegate' is deprecated. Creating DefaultReactActivityDelegate with flags is deprecated.
694-
695-> Task :app:compileReleaseJavaWithJavac
696-> Task :app:mergeReleaseGeneratedProguardFiles
697-> Task :app:processReleaseJavaRes
```
