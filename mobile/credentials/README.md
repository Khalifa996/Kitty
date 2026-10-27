# Sideload signing key

`sideload.keystore` signs the test APKs that GitHub builds, so each new build installs over the last one.
It uses Android's standard debug passwords and is **only for test builds**. The Play Store release will use a separate private upload key that is never committed.
