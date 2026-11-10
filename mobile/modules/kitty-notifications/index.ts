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
  getAppLabel(pkg: string): string;
  rebind?(): void;
  setMorning?(json: string): void;
  morningOff?(): void;
  showNow?(title: string, body: string): void;
  canNotify?(): boolean;
  openNotificationSettings?(): void;
  notifyPayment?(json: string): void;
  takeActions?(): string;
  scheduleBrain?(at: number): void;
  setSurfaces?(json: string): void;
  widgetCount?(): number;
  pinWidget?(): boolean;
  ignoresBatteryLimits?(): boolean;
  askBatteryLimits?(): void;
  addListener(event: 'onCapture', cb: (e: { json: string }) => void): Subscription;
};

// Missing in Expo Go and on iPhone: callers must handle null
export const KittyNotifications = requireOptionalNativeModule<NativeKitty>('KittyNotifications');
