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
    Function("removeCaptured") { keys: List<String> -> CaptureStore.remove(ctx, keys) }
    Function("getCandidates") { CaptureStore.candidates(ctx) }
    Function("getExtraApps") { CaptureStore.extraApps(ctx).toList() }
    Function("setExtraApps") { pkgs: List<String> -> CaptureStore.setExtra(ctx, pkgs) }
  }
}
