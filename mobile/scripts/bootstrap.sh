#!/usr/bin/env bash
# One-off: let create-expo-app pick matching versions, then add Kitty's packages.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f package-lock.json ]; then echo "Already set up"; exit 0; fi
npx --yes create-expo-app@latest /tmp/tpl --template blank-typescript --no-install
node -e "
const fs=require('fs'); const t=require('/tmp/tpl/package.json');
t.name='kitty'; t.private=true; t.main='index.ts'; t.version='0.1.0';
t.scripts={...t.scripts, test:'jest', typecheck:'tsc --noEmit'};
t.jest={preset:'jest-expo', testPathIgnorePatterns:['/node_modules/','/android/']};
fs.writeFileSync('package.json', JSON.stringify(t,null,2)+'\n');"
npm install
npx expo install expo-clipboard expo-status-bar react-native-safe-area-context
npx expo install jest-expo jest @types/jest -- --save-dev
echo "Expo version: $(node -p "require('expo/package.json').version")"
