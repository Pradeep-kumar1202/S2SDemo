package com.s2sdemo.googlepay

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import com.google.android.gms.wallet.AutoResolveHelper
import com.google.android.gms.wallet.PaymentData
import org.json.JSONException
import org.json.JSONObject

/**
 * Invisible activity that presents the Google Pay sheet and reports the result
 * through [GooglePayCallbackManager].
 *
 * Expects a "googlePayRequest" string extra:
 *   { "paymentDataRequest": <Google PaymentDataRequest JSON>, "environment": "TEST" | "PRODUCTION" }
 *
 * Adapted from the Hyperswitch SDK (idea/GooglePayActivity.kt).
 */
class GooglePayActivity : Activity() {

    private val gPayRequestCode = 1212
    private lateinit var model: GooglePayViewModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val gPayRequestString = intent.getStringExtra("googlePayRequest")
        if (gPayRequestString.isNullOrBlank() || gPayRequestString == "null") {
            handleError("Failure")
            return
        }

        val gPayRequest = try {
            JSONObject(gPayRequestString)
        } catch (error: JSONException) {
            handleError("Failure")
            return
        }

        val environment = GooglePayEnvironment.from(gPayRequest.optString("environment", "TEST"))
        model = GooglePayViewModel(applicationContext, environment)

        val paymentDataRequest = gPayRequest.optJSONObject("paymentDataRequest")
        if (paymentDataRequest != null) {
            requestPayment(paymentDataRequest)
        } else {
            handleError("Failure")
        }
    }

    private fun requestPayment(paymentDataRequestJson: JSONObject) {
        val task = model.getLoadPaymentDataTask(paymentDataRequestJson)

        // Calling GPay UI for Payment with gPayRequestCode for onActivityResult
        AutoResolveHelper.resolveTask(task, this, gPayRequestCode)
    }

    private fun handlePaymentSuccess(paymentData: PaymentData) {
        GooglePayCallbackManager.executeCallback(mutableMapOf<String, Any?>().apply {
            try {
                put("paymentMethodData", JSONObject(paymentData.toJson()).toString())
            } catch (error: JSONException) {
                put("error", error.message)
            }
        })
        finish()
    }

    private fun handleError(message: String) {
        GooglePayCallbackManager.executeCallback(mutableMapOf<String, Any?>().apply {
            put("error", message)
        })
        finish()
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == gPayRequestCode) {
            when (resultCode) {
                RESULT_OK -> {
                    val paymentData = data?.let { PaymentData.getFromIntent(it) }
                    if (paymentData != null) handlePaymentSuccess(paymentData) else handleError("Failure")
                }

                RESULT_CANCELED -> handleError("Cancel")

                else -> {
                    val status = data?.let { AutoResolveHelper.getStatusFromIntent(it) }
                    handleError(status?.statusMessage?.let { "Failure: $it" } ?: "Failure")
                }
            }
        }
    }
}
