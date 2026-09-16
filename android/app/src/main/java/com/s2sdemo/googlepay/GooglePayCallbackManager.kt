package com.s2sdemo.googlepay

import android.content.Context
import android.content.Intent

typealias Callback = (Map<String, Any?>) -> Unit

/**
 * Holds the pending JS callback while [GooglePayActivity] drives the Google Pay sheet.
 * Adapted from the Hyperswitch SDK (idea/GooglePayCallBackManager.kt).
 */
object GooglePayCallbackManager {
    private var callback: Callback? = null

    fun setCallback(appContext: Context, request: String, newCallback: Callback) {
        callback = newCallback
        val myIntent = Intent(
            appContext,
            GooglePayActivity::class.java
        )
        myIntent.putExtra("googlePayRequest", request)
        myIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        appContext.startActivity(myIntent)
    }

    fun getCallback(): Callback? {
        return callback
    }

    fun executeCallback(data: Map<String, Any?>) {
        val cb = callback
        callback = null
        cb?.invoke(data) ?: println("No callback set")
    }
}
