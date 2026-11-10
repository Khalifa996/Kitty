package expo.modules.kittynotifications

import android.app.AlarmManager
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
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * The morning message. The app writes the next morning's figure whenever it's open (setMorning);
 * an alarm posts it at the chosen hour. If bank alerts came in after the app last worked it out,
 * the message says so rather than pretending the figure is up to date.
 */
object Morning {
  private const val PREFS = "kitty_morning"
  private const val CHANNEL = "morning"
  private const val ID = 4201

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  private fun msg(ctx: Context): JSONObject? = try { prefs(ctx).getString("msg", null)?.let { JSONObject(it) } } catch (e: Exception) { null }
  private fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.UK).format(Calendar.getInstance().time)
  private fun alarms(ctx: Context) = ctx.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
  private fun pending(ctx: Context): PendingIntent = PendingIntent.getBroadcast(
    ctx, ID, Intent(ctx, MorningReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

  fun save(ctx: Context, json: String) {
    prefs(ctx).edit().putString("msg", json).apply()
    schedule(ctx)
  }

  fun off(ctx: Context) {
    prefs(ctx).edit().remove("msg").apply()
    try { alarms(ctx)?.cancel(pending(ctx)) } catch (e: Exception) { }
  }

  /** The next alarm at the chosen hour. Inexact, so Android may move it a few minutes, and no special permission is needed. */
  fun schedule(ctx: Context) {
    val m = msg(ctx) ?: return
    val c = Calendar.getInstance()
    c.set(Calendar.HOUR_OF_DAY, m.optInt("hour", 8))
    c.set(Calendar.MINUTE, m.optInt("minute", 0))
    c.set(Calendar.SECOND, 0)
    c.set(Calendar.MILLISECOND, 0)
    if (c.timeInMillis <= System.currentTimeMillis() || prefs(ctx).getString("posted", "") == today()) c.add(Calendar.DAY_OF_YEAR, 1)
    try { alarms(ctx)?.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, c.timeInMillis, pending(ctx)) } catch (e: Exception) { }
  }

  /** Bank alerts kept since the app last worked out the figure: those aren't in it yet. */
  private fun waiting(ctx: Context, since: Long): Int = try {
    val arr = JSONArray(CaptureStore.all(ctx))
    var n = 0
    for (i in 0 until arr.length()) if (arr.getJSONObject(i).optLong("time") > since) n++
    n
  } catch (e: Exception) { 0 }

  /** Called by the alarm. Posts once a day, with the figure the app worked out for today. */
  fun post(ctx: Context) {
    val m = msg(ctx) ?: return
    val day = today()
    if (prefs(ctx).getString("posted", "") == day) return
    val fresh = m.optString("day") == day
    val title = if (fresh) m.optString("title") else "What's safe to spend today?"
    var body = if (fresh) m.optString("body") else "Open Crest to work out today's figure."
    val n = waiting(ctx, m.optLong("savedAt", 0L))
    if (n > 0 && fresh) body = (if (body.isNotEmpty()) "$body " else "") +
      (if (n == 1) "1 bank alert isn't counted yet." else "$n bank alerts aren't counted yet.")
    // If the listener has been quiet for a day, Android or Samsung has probably stopped it
    val heard = CaptureStore.lastHeard(ctx)
    if (heard > 0 && System.currentTimeMillis() - heard > 24L * 3600 * 1000) body = (if (body.isNotEmpty()) "$body " else "") +
      "Crest hasn't heard any notifications for over a day. Open it to check alert access.
    show(ctx, title, body)
    prefs(ctx).edit().putString("posted", day).apply()
  }

  fun show(ctx: Context, title: String, body: String) {
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    if (Build.VERSION.SDK_INT >= 26) {
      val ch = NotificationChannel(CHANNEL, "Morning message", NotificationManager.IMPORTANCE_DEFAULT)
      ch.description = "What's safe to spend each morning"
      nm.createNotificationChannel(ch)
    }
    val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(ctx)
    b.setSmallIcon(R.drawable.crest_notify)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(Notification.BigTextStyle().bigText(body))
      .setColor(0xFFC9A04A.toInt())
      .setAutoCancel(true)
    ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.let {
      b.setContentIntent(PendingIntent.getActivity(ctx, ID, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    }
    try { nm.notify(ID, b.build()) } catch (e: SecurityException) { /* notifications not allowed */ }
  }

  fun canNotify(ctx: Context): Boolean = (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager)?.areNotificationsEnabled() ?: false
}

class MorningReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    // Refresh the widget and work through anything waiting while the message goes out
    CrestBrainService.start(ctx.applicationContext, "tick")
    try { Morning.post(ctx) } catch (e: Exception) { }
    try { Morning.schedule(ctx) } catch (e: Exception) { }
  }
}
