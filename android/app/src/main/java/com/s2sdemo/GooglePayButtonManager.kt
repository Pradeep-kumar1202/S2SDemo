package com.s2sdemo

import android.view.View
import android.view.ViewGroup
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.HyperGooglePayButtonManagerDelegate
import com.facebook.react.viewmanagers.HyperGooglePayButtonManagerInterface
import com.google.android.gms.wallet.button.ButtonConstants
import com.google.android.gms.wallet.button.ButtonOptions
import com.google.android.gms.wallet.button.PayButton

/**
 * Fabric component wrapping Google's [PayButton] (see specs/HyperGooglePayNativeComponent.ts).
 *
 * Props: type (ButtonConstants.ButtonType, -1 = PAY), appearance (ButtonConstants.ButtonTheme),
 * borderRadius (dp). Press handling is left to the JS Pressable wrapping this view.
 */
@ReactModule(name = GooglePayButtonManager.REACT_CLASS)
class GooglePayButtonManager : SimpleViewManager<GooglePayButtonManager.GooglePayButtonView>(),
    HyperGooglePayButtonManagerInterface<GooglePayButtonManager.GooglePayButtonView> {

    private val delegate = HyperGooglePayButtonManagerDelegate(this)

    override fun getName(): String = REACT_CLASS

    override fun getDelegate(): ViewManagerDelegate<GooglePayButtonView> = delegate

    override fun createViewInstance(context: ThemedReactContext): GooglePayButtonView = GooglePayButtonView(context)

    override fun setType(view: GooglePayButtonView, value: Int) {
        view.buttonType = value
    }

    override fun setAppearance(view: GooglePayButtonView, value: Int) {
        view.buttonTheme = value
    }

    override fun setBorderRadius(view: GooglePayButtonView, value: Int) {
        view.cornerRadiusDp = value
    }

    override fun onAfterUpdateTransaction(view: GooglePayButtonView) {
        super.onAfterUpdateTransaction(view)
        view.rebuild()
    }

    /**
     * Container hosting a [PayButton]. PayButton's options are fixed once initialized,
     * so a prop change recreates the inner button.
     */
    class GooglePayButtonView(context: ThemedReactContext) : ViewGroup(context) {
        var buttonType: Int = -1
        var buttonTheme: Int = ButtonConstants.ButtonTheme.DARK
        var cornerRadiusDp: Int = 4

        private var button: PayButton? = null

        fun rebuild() {
            button?.let { removeView(it) }
            val type = if (buttonType <= 0) ButtonConstants.ButtonType.PAY else buttonType
            val radiusPx = (cornerRadiusDp * resources.displayMetrics.density).toInt()
            val options = ButtonOptions.newBuilder()
                .setButtonType(type)
                .setButtonTheme(buttonTheme)
                .setCornerRadius(radiusPx)
                .setAllowedPaymentMethods(DEFAULT_ALLOWED_PAYMENT_METHODS)
                .build()
            button = PayButton(context).also {
                it.initialize(options)
                addView(it, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
            }
            requestLayout()
        }

        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
            button?.measure(widthMeasureSpec, heightMeasureSpec)
            setMeasuredDimension(
                View.getDefaultSize(suggestedMinimumWidth, widthMeasureSpec),
                View.getDefaultSize(suggestedMinimumHeight, heightMeasureSpec),
            )
        }

        override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
            button?.layout(0, 0, r - l, b - t)
        }

        // React Native does not run a layout pass for native children, so force one here.
        override fun requestLayout() {
            super.requestLayout()
            post {
                measure(
                    MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
                    MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
                )
                layout(left, top, right, bottom)
            }
        }
    }

    companion object {
        const val REACT_CLASS = "HyperGooglePayButton"

        // Used only for the button's own rendering (card art); the actual request comes from the session token.
        private const val DEFAULT_ALLOWED_PAYMENT_METHODS = """
            [{"type":"CARD","parameters":{"allowedAuthMethods":["PAN_ONLY","CRYPTOGRAM_3DS"],
            "allowedCardNetworks":["AMEX","DISCOVER","JCB","MASTERCARD","VISA"]}}]
        """
    }
}
