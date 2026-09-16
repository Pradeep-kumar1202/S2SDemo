//
//  RCTNativeApplePay.mm
//  S2SDemo
//

#import "RCTNativeApplePay.h"

#import <PassKit/PassKit.h>
#import <React/RCTBridge.h>
// The generated Swift header references AppDelegate's superclass; ObjC++ cannot @import it, so declare it first.
#import <React-RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#import "S2SDemo-Swift.h"

@implementation RCTNativeApplePay {
  ApplePayHandler *_handler;
}

+ (NSString *)moduleName
{
  return @"NativeApplePay";
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeApplePaySpecJSI>(params);
}

- (void)canMakePayments:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(@([PKPaymentAuthorizationController canMakePayments]));
}

- (void)startPayment:(NSString *)request
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  // PassKit must be driven from the main thread.
  dispatch_async(dispatch_get_main_queue(), ^{
    // Keep a strong reference for the lifetime of the sheet; it is the PKPaymentAuthorizationController delegate.
    self->_handler = [ApplePayHandler new];

    __block BOOL settled = NO;
    [self->_handler startPaymentWithRnMessage:request
                                   rnCallback:^(NSArray *response) {
                                     if (settled) {
                                       return;
                                     }
                                     settled = YES;
                                     self->_handler = nil;
                                     resolve(response.firstObject ?: @{@"status" : @"Failed"});
                                   }
                              presentCallback:nil];
  });
}

@end
