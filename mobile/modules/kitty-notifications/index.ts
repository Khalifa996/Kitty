import { requireOptionalNativeModule } from 'expo-modules-core';

type Subscription = { remove(): void };
type NativeKitty = {
  isEnabled(): boolean;
  openSettings(): void;
  openAppInfo(): void;
  getCaptured(): string;
  removeCaptured(keys: string[]): void;
  getCandidates(): string[];
  getExtraApps(): string[];
  setExtraApps(pkgs: string[]): void;
  addListener(event: 'onCapture', cb: (e: { json: string }) => void): Subscription;
};

// Missing in Expo Go and on iPhone: callers must handle null
export const KittyNotifications = requireOptionalNativeModule<NativeKitty>('KittyNotifications');
