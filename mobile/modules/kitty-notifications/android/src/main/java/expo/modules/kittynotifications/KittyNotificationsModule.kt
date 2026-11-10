package expo.modules.kittynotifications

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class KittyNotificationsModule : Module() {
  companion object {
    @Volatile private var instance: KittyNotificationsModule? = null
    fun emit(item: JSONObject) {
      try { instance?.sendEvent("onCapture", mapOf("json" to item.toString())) } catch (e: Exception) {}
    }
  }

  private val ctx: Context
    get() = requireNotNull(appContext.reactContext) { "No Android context" }

  override fun definition() = ModuleDefinition {
    Name("KittyNotifications")
    Events("onCapture")

    OnCreate { instance = this@KittyNotificationsModule }
    OnDestroy { if (instance === this@KittyNotificationsModule) instance = null }

    Function("isEnabled") {
      val flat = Settings.Secure.getString(ctx.contentResolver, "enabled_notification_listeners") ?: ""
      flat.split(":").any { it.startsWith(ctx.packageName + "/") }
    }

    Function("openSettings") {
      val i = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(i)
    }

    // On Android 13+, apps installed from a file need "Allow restricted settings" in App info first
    Function("openAppInfo") {
      val i = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(i)
    }

    Function("getCaptured") { CaptureStore.all(ctx) }
    // Ask Android to reconnect the listener if it was dropped (after an update, or to save battery)
    Function("rebind") {
      try { android.service.notification.NotificationListenerService.requestRebind(android.content.ComponentName(ctx, KittyNotificationListener::class.java)) } catch (e: Exception) { }
    }
    Function("removeCaptured") { keys: List<String> -> CaptureStore.remove(ctx, keys) }
    Function("getCandidates") { CaptureStore.candidates(ctx) }
    Function("getExtraApps") { CaptureStore.extraApps(ctx).toList() }
    Function("setExtraApps") { pkgs: List<String> -> CaptureStore.setExtra(ctx, pkgs) }
    Function("getAppLabel") { pkg: String -> CaptureStore.label(ctx, pkg) }

    // The morning message: the app hands over the next one whenever it's open
    Function("setMorning") { json: String -> Morning.save(ctx, json) }
    Function("morningOff") { Morning.off(ctx) }
    Function("showNow") { title: String, body: String -> Morning.show(ctx, title, body) }
    Function("canNotify") { Morning.canNotify(ctx) }

    // The background brain and what it shows outside the app
    Function("notifyPayment") { json: String -> PaymentNotices.show(ctx, json) }
    Function("takeActions") { PaymentNotices.take(ctx) }
    Function("scheduleBrain") { at: Double -> CrestBrainService.at(ctx, at.toLong()) }
    Function("setSurfaces") { json: String -> Surfaces.save(ctx, json) }
    Function("widgetCount") { CrestWidget.ids(ctx).size }
    Function("pinWidget") { CrestWidget.pin(ctx) }

    // Samsung puts apps to sleep to save battery; being left out of that keeps the listener running
    Function("ignoresBatteryLimits") {
      val pm = ctx.getSystemService(Context.POWER_SERVICE) as? android.os.PowerManager
      pm?.isIgnoringBatteryOptimizations(ctx.packageName) ?: true
    }
    Function("askBatteryLimits") {
      val i = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + ctx.packageName)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try { ctx.startActivity(i) } catch (e: Exception) {
        ctx.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }
    Function("openNotificationSettings") {
      val i = if (android.os.Build.VERSION.SDK_INT >= 26)
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
      else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName))
      ctx.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }
}
