package expo.modules.kittynotifications

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject

/** Android hands every new notification to this service once the person allows it. */
class KittyNotificationListener : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    val n = sbn ?: return
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
