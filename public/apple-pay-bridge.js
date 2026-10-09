/**
 * Apple Pay bridge — the script the merchant's top-level page mounts.
 *
 * The checkout runs in an iframe on its own domain, and Apple Pay does not run
 * there: the ApplePaySession has to live in the top-level window, on the domain
 * Apple verified. So the merchant page loads this script from the checkout's
 * domain, and the iframe drives Apple Pay through it with postMessage — the way
 * hyperswitch-web's HyperLoader does (`src/hyper-loader/Hyper.res`).
 *
 * Messages, iframe -> top:
 *   hyperApplePayCanMakePayments            can this window run Apple Pay?
 *   hyperApplePayButtonClicked + paymentRequest
 *                                           start the sheet
 *   applePayMerchantSession                 the session to validate with
 *   applePayMerchantSessionError            there is none; abort the sheet
 *
 * Messages, top -> iframe:
 *   applePayCanMakePayments (boolean)       the answer to the first question
 *   applePayValidateMerchant                Apple asked for the merchant session
 *   applePayPaymentToken + applePayBillingContact + applePayShippingContact
 *                                           the player authorised
 *   showApplePayButton (+ applePayCancelled | applePayError)
 *                                           the sheet closed without a payment
 *
 * One difference from hyperswitch-web: the merchant session is asked for when
 * Apple asks (applePayValidateMerchant) rather than sent with the click. The
 * deposit screen opens the sheet while the amount update is still in flight,
 * and the session minted for the new amount only exists once it lands.
 *
 * Every message carries the `requestId` the iframe chose, and only messages
 * from the checkout's own origin — the origin this script was served from —
 * are acted on, so another frame on the page cannot start or answer a session.
 */
(function () {
  if (window.__applePayBridgeMounted) {
    return;
  }
  window.__applePayBridgeMounted = true;

  var script = document.currentScript;
  if (!script || !script.src) {
    console.error('apple-pay-bridge: load this file with a <script src>.');
    return;
  }
  var CHECKOUT_ORIGIN = new URL(script.src).origin;

  /** The sheet being shown, if any: one at a time, as Safari allows. */
  var current = null;

  function canMakePayments() {
    try {
      return (
        typeof window.ApplePaySession !== 'undefined' &&
        window.ApplePaySession.canMakePayments()
      );
    } catch {
      return false;
    }
  }

  function send(target, message) {
    target.postMessage(message, CHECKOUT_ORIGIN);
  }

  function messageOf(error) {
    return error && error.message ? error.message : String(error);
  }

  /**
   * Opens the sheet. Called straight from the click message, with nothing
   * awaited first: Safari only allows the session while the tap is handled.
   */
  function start(source, requestId, paymentRequest) {
    if (current) {
      // A newer tap replaces the old sheet, as hyperswitch-web does.
      var previous = current;
      previous.finish({ showApplePayButton: true, applePayCancelled: true });
      try {
        previous.session.abort();
      } catch {
        // Already closed.
      }
    }

    var settled = false;
    var attempt = { session: null, source: source, requestId: requestId };

    // Only the first outcome is reported: abort() raises a cancel of its own.
    attempt.finish = function (message) {
      if (settled) {
        return;
      }
      settled = true;
      if (current === attempt) {
        current = null;
      }
      message.requestId = requestId;
      send(source, message);
    };

    try {
      attempt.session = new window.ApplePaySession(3, paymentRequest);
    } catch (error) {
      attempt.finish({ showApplePayButton: true, applePayError: messageOf(error) });
      return;
    }
    current = attempt;

    attempt.session.onvalidatemerchant = function () {
      send(source, { applePayValidateMerchant: true, requestId: requestId });
    };

    attempt.session.onpaymentauthorized = function (event) {
      attempt.session.completePayment(window.ApplePaySession.STATUS_SUCCESS);
      // A plain copy, so the token crosses postMessage as data.
      var payment = JSON.parse(JSON.stringify(event.payment));
      attempt.finish({
        applePayPaymentToken: payment.token,
        applePayBillingContact: payment.billingContact || null,
        applePayShippingContact: payment.shippingContact || null,
      });
    };

    attempt.session.oncancel = function () {
      attempt.finish({ showApplePayButton: true, applePayCancelled: true });
    };

    attempt.session.begin();
  }

  /** The iframe's answer to applePayValidateMerchant. */
  function validate(data) {
    var attempt = current;
    if (!attempt || attempt.requestId !== data.requestId) {
      return;
    }
    if (data.applePayMerchantSession) {
      try {
        attempt.session.completeMerchantValidation(data.applePayMerchantSession);
        return;
      } catch (error) {
        data = { applePayMerchantSessionError: messageOf(error) };
      }
    }
    // Report the reason before aborting, so it is not lost to the cancel.
    attempt.finish({
      showApplePayButton: true,
      applePayError:
        data.applePayMerchantSessionError || 'No validated merchant session',
    });
    try {
      attempt.session.abort();
    } catch {
      // Already closed.
    }
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== CHECKOUT_ORIGIN || !event.source) {
      return;
    }
    var data = event.data;
    if (!data || typeof data !== 'object' || typeof data.requestId !== 'string') {
      return;
    }

    if (data.hyperApplePayCanMakePayments) {
      send(event.source, {
        applePayCanMakePayments: canMakePayments(),
        requestId: data.requestId,
      });
    } else if (data.hyperApplePayButtonClicked) {
      start(event.source, data.requestId, data.paymentRequest);
    } else if (
      'applePayMerchantSession' in data ||
      'applePayMerchantSessionError' in data
    ) {
      validate(data);
    }
  });
})();
