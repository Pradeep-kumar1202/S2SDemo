package com.s2sdemo

import android.annotation.SuppressLint
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.s2sdemo.specs.NativeDdcSpec
import java.util.concurrent.atomic.AtomicBoolean

/**
 * TurboModule running device data collection off-screen (see specs/NativeDdc.ts).
 *
 * Before an issuer decides whether to challenge the player, it wants to read
 * the device itself, from a page of its own. That page has to run somewhere, so
 * this loads it in a WebView the player never sees: 1x1, pushed off-screen, and
 * hidden from accessibility.
 *
 * The URL is not loaded directly. It goes inside a wrapper page whose only job
 * is to listen for the message the issuer's iframe posts and hand it to JS
 * through `HyperDDCBridge` -- a WebView cannot post to the app on its own.
 *
 * Answers exactly once, with the message or with "" when the page never spoke,
 * and takes the WebView down on every path.
 */
class DdcModule(reactContext: ReactApplicationContext) : NativeDdcSpec(reactContext) {

    override fun getName(): String = NAME

    @SuppressLint("SetJavaScriptEnabled")
    override fun openIframeBridge(url: String, timeoutMs: Double, promise: Promise) {
        // Zero means "give up now", so the caller must resolve its own default.
        if (timeoutMs <= 0 || url.isBlank()) {
            promise.resolve("")
            return
        }

        val mainHandler = Handler(Looper.getMainLooper())
        val answered = AtomicBoolean(false)
        var webView: WebView? = null
        var timeoutRunnable: Runnable? = null

        // The timeout, a navigation failure and the message itself all race to
        // get here; the flag decides, so the promise is settled once.
        val answer = { message: String ->
            if (answered.compareAndSet(false, true)) {
                timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
                mainHandler.post {
                    webView?.let { view ->
                        try {
                            (view.parent as? ViewGroup)?.removeView(view)
                            view.stopLoading()
                            view.destroy()
                        } catch (error: Exception) {
                            Log.e(TAG, "cleanup error: ${error.message}")
                        }
                    }
                    webView = null
                }
                promise.resolve(message)
            }
        }

        mainHandler.post {
            val activity = reactApplicationContext.currentActivity ?: run {
                answer("")
                return@post
            }

            val view = try {
                WebView(activity)
            } catch (error: Exception) {
                // No usable WebView provider on this device.
                Log.e(TAG, "WebView unavailable: ${error.message}")
                answer("")
                return@post
            }

            view.settings.javaScriptEnabled = true
            view.addJavascriptInterface(
                object : Any() {
                    @JavascriptInterface
                    fun onMessage(data: String) {
                        answer(data)
                    }
                },
                "HyperDDCBridge",
            )

            // Attached rather than detached: a WebView that is never laid out
            // may not run its JavaScript at all. Out of sight is enough.
            view.apply {
                isFocusable = false
                isFocusableInTouchMode = false
                layoutParams = ViewGroup.LayoutParams(1, 1)
                translationX = -9999f
                translationY = -9999f
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
            }
            activity.findViewById<ViewGroup>(android.R.id.content).addView(view)
            webView = view

            // `url` is the base so the wrapper shares its origin, which is what
            // lets the iframe's message reach this listener.
            val wrapperHtml =
                """
                <html><body>
                <iframe src="$url" style="display:none;width:1px;height:1px;"></iframe>
                <script>
                window.addEventListener('message', function(event) {
                  var str = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
                  try { HyperDDCBridge.onMessage(str); } catch(e) {}
                });
                </script>
                </body></html>
                """.trimIndent()
            view.loadDataWithBaseURL(url, wrapperHtml, "text/html", "UTF-8", null)

            timeoutRunnable = Runnable { answer("") }.also {
                mainHandler.postDelayed(it, timeoutMs.toLong())
            }
        }
    }

    companion object {
        const val NAME = "NativeDdc"
        private const val TAG = "DdcModule"
    }
}
