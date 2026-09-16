package com.s2sdemo.googlepay

import com.google.android.gms.wallet.WalletConstants

enum class GooglePayEnvironment(
    internal val value: Int
) {
    Production(WalletConstants.ENVIRONMENT_PRODUCTION),
    Test(WalletConstants.ENVIRONMENT_TEST);

    companion object {
        /** "PRODUCTION" -> Production; anything else -> Test. */
        fun from(name: String?): GooglePayEnvironment =
            if (name.equals("PRODUCTION", ignoreCase = true)) Production else Test
    }
}
