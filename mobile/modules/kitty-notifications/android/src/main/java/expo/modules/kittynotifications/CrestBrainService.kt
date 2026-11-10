package expo.modules.kittynotifications

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Runs Crest's brain (the same TypeScript the app uses) without the app being open: Android starts this when a bank
 * alert arrives, when a notification button is tapped, or when a waiting payment has settled. The JavaScript side is
 * registered as "CrestBrain" in index.ts.
 */
class CrestBrainService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val extras = intent?.extras ?: Bundle()
    return HeadlessJsTaskConfig("CrestBrain", Arguments.fromBundle(extras), 30_000L, true)
  }

  companion object {
    private val handler = Handler(Looper.getMainLooper())
    private const val TOKEN = "crest-brain"
    private const val ALARM_ID = 4210

    /** Start the brain shortly, so a bank alert and its Google Wallet copy arriving together are read in one go. */
    fun soon(ctx: Context, reason: String, delayMs: Long = 2500L) {
      val app = ctx.applicationContext
      handler.removeCallbacksAndMessages(TOKEN)
      handler.postAtTime({ start(app, reason) }, TOKEN, SystemClock.uptimeMillis() + delayMs)
    }

    fun start(ctx: Context, reason: String) {
      try {
        HeadlessJsTaskService.acquireWakeLockNow(ctx)
        ctx.startService(Intent(ctx, CrestBrainService::class.java).putExtra("reason", reason))
      } catch (e: Exception) {
        // Android can refuse in rare cases; the app catches up when it next opens
      }
    }

    /** Run again at a set time (when a waiting payment has settled). Inexact, so no special permission is needed. */
    fun at(ctx: Context, timeMs: Long) {
      try {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val pi = PendingIntent.getBroadcast(ctx, ALARM_ID, Intent(ctx, BrainAlarmReceiver::class.java),
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timeMs, pi)
      } catch (e: Exception) { }
    }
  }
}

class BrainAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    CrestBrainService.start(ctx.applicationContext, "tick")
  }
}
