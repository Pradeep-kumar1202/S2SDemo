package com.s2sdemo.googlepay

import android.content.Context
import android.util.Log
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.tasks.Task
import com.google.android.gms.wallet.IsReadyToPayRequest
import com.google.android.gms.wallet.PaymentData
import com.google.android.gms.wallet.PaymentDataRequest
import com.google.android.gms.wallet.PaymentsClient
import com.google.android.gms.wallet.Wallet
import org.json.JSONObject

/**
 * Thin wrapper over Google's [PaymentsClient].
 * Adapted from the Hyperswitch SDK (idea/GooglePayViewModel.kt).
 */
class GooglePayViewModel(context: Context, environment: GooglePayEnvironment) {

    private val paymentsClient: PaymentsClient = createPaymentsClient(context, environment)

    fun fetchCanUseGooglePay(isReadyToPayJson: JSONObject, onResult: (Boolean) -> Unit) {
        val request = IsReadyToPayRequest.fromJson(isReadyToPayJson.toString())
        paymentsClient.isReadyToPay(request).addOnCompleteListener { completedTask ->
            val isAvailable = try {
                completedTask.getResult(ApiException::class.java) ?: false
            } catch (exception: ApiException) {
                Log.w("GPAY", "isReadyToPay failed", exception)
                false
            }
            Log.d("GPAY", "GPAY CAN BE USED $isAvailable")
            onResult(isAvailable)
        }
    }

    fun getLoadPaymentDataTask(paymentDataRequestJson: JSONObject): Task<PaymentData> {
        val request = PaymentDataRequest.fromJson(paymentDataRequestJson.toString())
        return paymentsClient.loadPaymentData(request)
    }

    private fun createPaymentsClient(context: Context, environment: GooglePayEnvironment): PaymentsClient {
        val walletOptions = Wallet.WalletOptions.Builder()
            .setEnvironment(environment.value)
            .build()

        return Wallet.getPaymentsClient(context, walletOptions)
    }
}
