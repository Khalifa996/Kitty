package expo.modules.kittynotifications

import android.app.Notification
import android.content.ComponentName
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject

/** Android hands every new notification to this service once the person allows it. */
class KittyNotificationListener : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    val n = sbn ?: return
    handle(n)
    CaptureStore.markHeard(this, n.postTime)
  }

  /**
   * Android connects the listener when the phone starts, after the app updates, or after it was stopped to save battery.
   * Anything a bank posted while Crest wasn't listening is usually still in the notification shade, so pick it up now.
   * Only notifications newer than the last one Crest heard are read, so nothing already handled comes back.
   */
  override fun onListenerConnected() {
    try {
      val since = CaptureStore.lastHeard(this)
      val active = activeNotifications ?: return
      var newest = since
      for (n in active.sortedBy { it.postTime }) {
        if (since > 0 && n.postTime > since) handle(n)
        if (n.postTime > newest) newest = n.postTime
      }
      CaptureStore.markHeard(this, if (since > 0) newest else System.currentTimeMillis())
    } catch (e: Exception) {
      // Reading the shade is a best effort
    }
  }

  /** If Android drops the connection, ask to be connected again rather than going quiet. */
  override fun onListenerDisconnected() {
    try { requestRebind(ComponentName(this, KittyNotificationListener::class.java)) } catch (e: Exception) { }
  }

  private fun handle(n: StatusBarNotification) {
    try {
      val pkg = n.packageName ?: return
      val notif = n.notification ?: return
      if (notif.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
      val extras = notif.extras ?: return
      val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
      val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
      val big = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString() ?: ""
      val body = if (big.length > text.length) big else text

      if (!CaptureStore.isWatched(this, pkg)) {
        CaptureStore.noteCandidate(this, pkg, "$title $body")
        return
      }
      val item = JSONObject()
        .put("key", "${n.key}|${n.postTime}")
        .put("pkg", pkg)
        .put("app", if (CaptureStore.BANK_APPS.contains(pkg)) "" else CaptureStore.label(this, pkg))
        .put("title", title)
        .put("text", body)
        .put("time", n.postTime)
      CaptureStore.add(this, item)
      KittyNotificationsModule.emit(item)
    } catch (e: Exception) {
      // Never let a strange notification crash the listener
    }
  }
}
