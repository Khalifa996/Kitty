package expo.modules.kittynotifications

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

/**
 * Crest's own message a few seconds after the bank's: the payment, its category and the new figure for today, with
 * up to three buttons to put it right. A tap is queued and the brain applies it, without opening the app.
 */
object PaymentNotices {
  private const val CHANNEL = "after_payment"
  private const val PREFS = "kitty_actions"

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  fun idFor(key: String): Int = 5000 + (key.hashCode() and 0x0fffffff) % 100000

  private fun channel(ctx: Context, nm: NotificationManager) {
    if (Build.VERSION.SDK_INT < 26) return
    // Pops up, but silently: the bank's own alert has already made a sound
    val ch = NotificationChannel(CHANNEL, "After each payment", NotificationManager.IMPORTANCE_HIGH)
    ch.description = "The new figure for today, a few seconds after your bank's alert"
    ch.setSound(null, null)
    ch.enableVibration(false)
    nm.createNotificationChannel(ch)
  }

  fun show(ctx: Context, json: String) {
    val n = JSONObject(json)
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    channel(ctx, nm)
    val key = n.optString("id")
    val id = idFor(key)
    val title = n.optString("title")
    val body = n.optString("body")
    val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(ctx)
    b.setSmallIcon(R.drawable.crest_notify)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(Notification.BigTextStyle().bigText(body))
      .setColor(0xFFC9A04A.toInt())
      .setAutoCancel(true)
      .setOnlyAlertOnce(true)
      .setCategory(Notification.CATEGORY_STATUS)
    if (Build.VERSION.SDK_INT >= 26) b.setTimeoutAfter(12L * 3600 * 1000)
    ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.let {
      b.setContentIntent(PendingIntent.getActivity(ctx, id, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    }
    val acts = n.optJSONArray("actions") ?: JSONArray()
    for (i in 0 until minOf(acts.length(), 3)) {
      val a = acts.getJSONObject(i)
      val intent = Intent(ctx, PaymentActionReceiver::class.java).putExtra("act", a.optString("key")).putExtra("nid", id).putExtra("title", title)
      val pi = PendingIntent.getBroadcast(ctx, id * 4 + i, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      val icon = android.graphics.drawable.Icon.createWithResource(ctx, R.drawable.crest_notify)
      b.addAction(Notification.Action.Builder(icon, a.optString("label"), pi).build())
    }
    try { nm.notify(id, b.build()) } catch (e: SecurityException) { /* notifications not allowed */ }
  }

  /** Show that a tap was taken, straight away, while the brain works out the new figure. */
  fun working(ctx: Context, id: Int, title: String) {
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    channel(ctx, nm)
    val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(ctx)
    b.setSmallIcon(R.drawable.crest_notify).setContentTitle(title).setContentText("Updating…").setOnlyAlertOnce(true).setColor(0xFFC9A04A.toInt())
    try { nm.notify(id, b.build()) } catch (e: SecurityException) { }
  }

  @Synchronized fun queue(ctx: Context, act: String) {
    val arr = try { JSONArray(prefs(ctx).getString("q", "[]")) } catch (e: Exception) { JSONArray() }
    arr.put(act)
    prefs(ctx).edit().putString("q", arr.toString()).commit()
  }

  /** Hand the queued taps to the brain and clear the queue. */
  @Synchronized fun take(ctx: Context): String {
    val s = prefs(ctx).getString("q", "[]") ?: "[]"
    prefs(ctx).edit().putString("q", "[]").commit()
    return s
  }
}

class PaymentActionReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val act = intent.getStringExtra("act") ?: return
    PaymentNotices.queue(ctx, act)
    PaymentNotices.working(ctx, intent.getIntExtra("nid", 0), intent.getStringExtra("title") ?: "Crest")
    CrestBrainService.start(ctx.applicationContext, "action")
  }
}
