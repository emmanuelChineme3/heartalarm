# Heart Alarm — Android (Capacitor)

The web app in this repo doubles as the source for the Android build. A thin
Capacitor shell wraps the deployed PWA (`https://heartalarm.lovable.app`) so
every web push is live in the Android app immediately — no store re-review
required for content updates.

## App identity

- Package: `com.heartalarm.app`
- App name: `Heart Alarm`
- Launcher icon: `public/app-icon.png` (also used as `favicon.png`)

## One-time setup (on your machine)

You need Node/Bun, JDK 17, and Android Studio installed.

```bash
git clone https://github.com/emmanuelChineme3/heartalarm-app.git
cd heartalarm-app
bun install
bun run build                 # produces dist/
bunx cap add android          # generates the android/ native project
bunx cap sync android         # copies web + config into android/
```

## Generate all Android launcher icons (adaptive)

The uploaded icon lives at `public/app-icon.png` (512×512). Use
`@capacitor/assets` to generate every mipmap density + adaptive icon:

```bash
bun add -D @capacitor/assets
mkdir -p resources
cp public/app-icon.png resources/icon.png       # foreground/full icon
cp public/app-icon.png resources/icon-only.png
cp public/app-icon.png resources/icon-background.png
bunx @capacitor/assets generate --android
```

This writes to `android/app/src/main/res/mipmap-*` and generates the
adaptive icon XML for Android 8+.

## Build

Open `android/` in Android Studio and build, or from the command line:

```bash
cd android
./gradlew assembleRelease      # APK  -> app/build/outputs/apk/release/
./gradlew bundleRelease        # AAB  -> app/build/outputs/bundle/release/
```

## Signing

Create `android/keystore.properties` (git-ignored) with your existing
keystore info:

```
storeFile=heart-alarm.keystore
storePassword=***
keyAlias=heartalarm
keyPassword=***
```

Then in `android/app/build.gradle` add above `android { … }`:

```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file("keystore.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

And inside `android { … }`:

```gradle
signingConfigs {
    release {
        storeFile file(keystoreProperties['storeFile'])
        storePassword keystoreProperties['storePassword']
        keyAlias keystoreProperties['keyAlias']
        keyPassword keystoreProperties['keyPassword']
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        shrinkResources true
    }
}
```

## GitHub Actions

A ready workflow lives at `.github/workflows/android-release.yml`. Add these
repo secrets:

- `ANDROID_KEYSTORE_BASE64` — `base64 -w0 heart-alarm.keystore`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Push to `main` → signed APK + AAB show up under the workflow run's artifacts.

## Publishing this repo

> Lovable's editor auto-commits to the Lovable-managed remote for this
> project; it does **not** push to `emmanuelChineme3/heartalarm-app`.
> To seed that repo from your machine:
>
> ```bash
> git clone <lovable-managed-remote>
> cd heartalarm-app
> git remote set-url origin https://github.com/emmanuelChineme3/heartalarm-app.git
> git push -u origin main
> ```
