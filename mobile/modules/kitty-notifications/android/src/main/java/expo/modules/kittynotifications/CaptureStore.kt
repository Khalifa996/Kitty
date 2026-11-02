package expo.modules.kittynotifications

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * Keeps captured bank alerts on the phone until Kitty has read them.
 * Only alerts from bank apps the person has allowed are stored.
 */
object CaptureStore {
  private const val PREFS = "kitty_capture"
  private const val ITEMS = "items"
  private const val EXTRA = "extra_pkgs"
  private const val SEEN = "seen_pkgs"
  private const val MAX = 300

  val BANK_APPS = setOf(
    "com.revolut.revolut",
    "com.barclays.android.barclaysmobilebanking",
    "com.barclaycard.barclaycardmobile",
    "co.uk.getmondo",
    "com.starlingbank.android",
    "com.rbs.mobile.android.natwest",
    "com.rbs.mobile.android.rbs",
    "com.rbs.mobile.android.ubr",
    "com.grppl.android.shell.CMBlloydsTSB73",
    "com.grppl.android.shell.halifax",
    "com.grppl.android.shell.BOS",
    "uk.co.hsbc.hsbcukmobilebanking",
    "com.firstdirect.bankingonthego",
    "uk.co.santander.santanderUK",
    "co.uk.Nationwide.Mobile",
    "uk.co.tsb.newmobilebank",
    "com.chase.intl",
    "com.americanexpress.android.acctsvcs.uk",
    "com.virginmoney.uk.mobile.android",
    "com.kroo.app",
    "com.imaginecurve.curve.prd",
    "com.google.android.apps.walletnfcrel"
  )

  private val MONEY = Regex("(£|GBP)\\s?\\d")

  // Never read, even if turned on: chats, email, texts and social apps carry private messages, and marketplaces,
  // app stores and ride or delivery apps only repeat money counted when it reaches the bank. Same list as NEVER_PKG in bankAlerts.ts.
  private val NEVER = Regex("whatsapp|telegram|thoughtcrime|signal|messag|\\.mms|\\bsms|mail|android\\.gm\$|outlook|snapchat|instagram|facebook|discord|slack|teams|viber|naver\\.line|skype|twitter|linkedin|musically|tiktok|reddit|dynamite|airtasker|amazon|samsungapps|android\\.vending|vinted|ebay|ubercab|deliveroo|justeat|depop|etsy", RegexOption.IGNORE_CASE)

  fun neverRead(pkg: String) = !BANK_APPS.contains(pkg) && NEVER.containsMatchIn(pkg)

  private fun prefs(ctx: Context): SharedPreferences = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun extraApps(ctx: Context): Set<String> = prefs(ctx).getStringSet(EXTRA, emptySet()) ?: emptySet()

  fun isWatched(ctx: Context, pkg: String) = BANK_APPS.contains(pkg) || (extraApps(ctx).contains(pkg) && !neverRead(pkg))

  /** Remember (name only, never content) other apps that post money alerts, so Kitty can offer to watch them. */
  @Synchronized
  fun noteCandidate(ctx: Context, pkg: String, text: String) {
    if (pkg == ctx.packageName || neverRead(pkg) || isWatched(ctx, pkg) || !MONEY.containsMatchIn(text)) return
    val seen = (prefs(ctx).getStringSet(SEEN, emptySet()) ?: emptySet()).toMutableSet()
    if (seen.add(pkg)) prefs(ctx).edit().putStringSet(SEEN, seen).apply()
  }

  fun candidates(ctx: Context): List<String> = (prefs(ctx).getStringSet(SEEN, emptySet()) ?: emptySet()).filter { !isWatched(ctx, it) && !neverRead(it) }

  /** The name people know an app by, for apps Kitty can see. Falls back to the package name. */
  fun label(ctx: Context, pkg: String): String = try {
    val pm = ctx.packageManager
    pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
  } catch (e: Exception) { pkg }

  fun setExtra(ctx: Context, pkgs: List<String>) {
    prefs(ctx).edit().putStringSet(EXTRA, pkgs.filter { !neverRead(it) }.toSet()).apply()
  }

  @Synchronized
  fun add(ctx: Context, item: JSONObject) {
    val arr = JSONArray(prefs(ctx).getString(ITEMS, "[]"))
    val key = item.optString("key")
    for (i in 0 until arr.length()) if (arr.getJSONObject(i).optString("key") == key) return
    arr.put(item)
    val trimmed = JSONArray()
    val start = maxOf(0, arr.length() - MAX)
    for (i in start until arr.length()) trimmed.put(arr.get(i))
    prefs(ctx).edit().putString(ITEMS, trimmed.toString()).apply()
  }

  @Synchronized
  fun all(ctx: Context): String = prefs(ctx).getString(ITEMS, "[]") ?: "[]"

  @Synchronized
  fun remove(ctx: Context, keys: List<String>) {
    val drop = keys.toSet()
    val arr = JSONArray(prefs(ctx).getString(ITEMS, "[]"))
    val kept = JSONArray()
    for (i in 0 until arr.length()) {
      val o = arr.getJSONObject(i)
      if (!drop.contains(o.optString("key"))) kept.put(o)
    }
    prefs(ctx).edit().putString(ITEMS, kept.toString()).apply()
  }
}
