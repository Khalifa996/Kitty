package expo.modules.kittynotifications

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

/**
 * Today's figure everywhere outside the app: the home and cover screen widget, the Quick Settings tile and, if the
 * person turns it on, an ongoing notification in the status bar. The brain hands over a ready-written snapshot
 * (amount, label, line), so nothing here needs to know about money.
 */
object Surfaces {
  private const val PREFS = "kitty_surfaces"
  private const val ONGOING_ID = 4300
  private const val CHANNEL = "today_figure"

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  fun snap(ctx: Context): JSONObject = try { JSONObject(prefs(ctx).getString("snap", "{}") ?: "{}") } catch (e: Exception) { JSONObject() }

  fun save(ctx: Context, json: String) {
    prefs(ctx).edit().putString("snap", json).apply()
    val s = snap(ctx)
    CrestWidget.updateAll(ctx)
    try { TileService.requestListeningState(ctx, ComponentName(ctx, CrestTile::class.java)) } catch (e: Exception) { }
    if (s.optBoolean("ongoing")) ongoing(ctx, s) else cancelOngoing(ctx)
  }

  fun openApp(ctx: Context, code: Int): PendingIntent? = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.let {
    PendingIntent.getActivity(ctx, code, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** Today's figure as an ongoing notification. On Android 16 it asks to be a Live Update (a status bar chip). */
  private fun ongoing(ctx: Context, s: JSONObject) {
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    if (Build.VERSION.SDK_INT >= 26) {
      val ch = NotificationChannel(CHANNEL, "Today's figure", NotificationManager.IMPORTANCE_LOW)
      ch.description = "What's safe to spend today, kept in the status bar"
      ch.setShowBadge(false)
      nm.createNotificationChannel(ch)
    }
    val amount = s.optString("amount")
    val label = s.optString("label")
    val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(ctx)
    b.setSmallIcon(R.drawable.crest_notify)
      .setContentTitle("$amount $label")
      .setContentText(s.optString("line"))
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
    openApp(ctx, ONGOING_ID)?.let { b.setContentIntent(it) }
    if (Build.VERSION.SDK_INT >= 36) {
      // Android 16 Live Updates. Called by name so older phones and build tools are unaffected
      try { b.javaClass.getMethod("setShortCriticalText", String::class.java).invoke(b, amount) } catch (e: Exception) { }
      try { b.javaClass.getMethod("setRequestPromotedOngoing", Boolean::class.javaPrimitiveType).invoke(b, true) } catch (e: Exception) { }
    }
    try { nm.notify(ONGOING_ID, b.build()) } catch (e: SecurityException) { }
  }

  private fun cancelOngoing(ctx: Context) {
    try { (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager)?.cancel(ONGOING_ID) } catch (e: Exception) { }
  }
}

/** The home and cover screen widget: "£12.40 left today", and the pay month underneath when there's room. */
class CrestWidget : AppWidgetProvider() {
  override fun onUpdate(ctx: Context, manager: AppWidgetManager, ids: IntArray) {
    for (id in ids) manager.updateAppWidget(id, views(ctx, manager, id))
  }

  override fun onAppWidgetOptionsChanged(ctx: Context, manager: AppWidgetManager, id: Int, options: android.os.Bundle?) {
    manager.updateAppWidget(id, views(ctx, manager, id))
  }

  companion object {
    fun ids(ctx: Context): IntArray = try {
      AppWidgetManager.getInstance(ctx).getAppWidgetIds(ComponentName(ctx, CrestWidget::class.java))
    } catch (e: Exception) { IntArray(0) }

    fun updateAll(ctx: Context) {
      try {
        val m = AppWidgetManager.getInstance(ctx)
        for (id in ids(ctx)) m.updateAppWidget(id, views(ctx, m, id))
      } catch (e: Exception) { }
    }

    /** Ask the launcher to add the widget to the home screen (it shows its own confirmation). */
    fun pin(ctx: Context): Boolean = try {
      val m = AppWidgetManager.getInstance(ctx)
      Build.VERSION.SDK_INT >= 26 && m.isRequestPinAppWidgetSupported && m.requestPinAppWidget(ComponentName(ctx, CrestWidget::class.java), null, null)
    } catch (e: Exception) { false }

    fun views(ctx: Context, m: AppWidgetManager, id: Int): RemoteViews {
      val s = Surfaces.snap(ctx)
      val v = RemoteViews(ctx.packageName, R.layout.crest_widget)
      val amount = s.optString("amount")
      v.setTextViewText(R.id.crest_amount, if (amount.isEmpty()) "Crest" else amount)
      v.setTextViewText(R.id.crest_label, s.optString("label", "Open Crest"))
      // Yesterday's figure is no use: say so until the brain has run today
      val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.UK).format(java.util.Date())
      val stale = s.optString("day").isNotEmpty() && s.optString("day") != today
      v.setTextViewText(R.id.crest_line, if (stale) "From yesterday · tap to update" else s.optString("line"))
      val colour = when (s.optString("tone")) { "over" -> 0xFFFF6B6B.toInt(); "low" -> 0xFFF2C14E.toInt(); else -> 0xFFE8D49A.toInt() }
      v.setTextColor(R.id.crest_amount, colour)
      // The line underneath only when the widget is tall enough
      val h = try { m.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT) } catch (e: Exception) { 0 }
      v.setViewVisibility(R.id.crest_line, if (h == 0 || h >= 90) View.VISIBLE else View.GONE)
      Surfaces.openApp(ctx, 4400 + id)?.let { v.setOnClickPendingIntent(R.id.crest_root, it) }
      return v
    }
  }
}

/** Quick Settings tile: today's figure one swipe down, from anywhere. */
class CrestTile : TileService() {
  override fun onStartListening() {
    super.onStartListening()
    val t = qsTile ?: return
    val s = Surfaces.snap(this)
    val amount = s.optString("amount")
    t.label = if (amount.isEmpty()) "Crest" else "$amount ${if (s.optString("label") == "over today") "over" else "left"}"
    if (Build.VERSION.SDK_INT >= 29) t.subtitle = "today"
    t.state = Tile.STATE_ACTIVE
    t.updateTile()
  }

  override fun onClick() {
    super.onClick()
    val pi = Surfaces.openApp(this, 4500) ?: return
    try {
      if (Build.VERSION.SDK_INT >= 34) startActivityAndCollapse(pi)
      else {
        val i = packageManager.getLaunchIntentForPackage(packageName) ?: return
        startActivityAndCollapse(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    } catch (e: Exception) { }
  }
}
