package com.s2sdemo

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.s2sdemo.googlepay.GooglePayCallbackManager
import com.s2sdemo.googlepay.GooglePayEnvironment
import com.s2sdemo.googlepay.GooglePayViewModel
import com.s2sdemo.specs.NativeGooglePaySpec
import org.json.JSONException
import org.json.JSONObject

/** TurboModule exposing Google Pay to JS (see specs/NativeGooglePay.ts). */
class GooglePayModule(reactContext: ReactApplicationContext) : NativeGooglePaySpec(reactContext) {

    override fun getName(): String = NAME

    override fun isReadyToPay(isReadyToPayRequest: String, environment: String, promise: Promise) {
        val json = try {
            JSONObject(isReadyToPayRequest)
        } catch (error: JSONException) {
            promise.reject("E_INVALID_REQUEST", "isReadyToPayRequest is not valid JSON", error)
            return
        }
        val model = GooglePayViewModel(reactApplicationContext, GooglePayEnvironment.from(environment))
        model.fetchCanUseGooglePay(json) { promise.resolve(it) }
    }

    override fun requestPayment(request: String, promise: Promise) {
        GooglePayCallbackManager.setCallback(reactApplicationContext, request) { data ->
            promise.resolve(Arguments.makeNativeMap(data))
        }
    }

    companion object {
        const val NAME = "NativeGooglePay"
    }
}
