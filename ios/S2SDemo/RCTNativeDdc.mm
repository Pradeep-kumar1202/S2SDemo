//
//  RCTNativeDdc.mm
//  S2SDemo
//

#import "RCTNativeDdc.h"

#import <React/RCTBridge.h>
// S2SDemo-Swift.h declares every @objc class in the app at once, so the frameworks
// those classes take protocols from have to be visible before it is imported —
// WebKit for this one, PassKit for the Apple Pay handler next door.
#import <PassKit/PassKit.h>
#import <WebKit/WebKit.h>
// The generated Swift header references AppDelegate's superclass; ObjC++ cannot @import it, so declare it first.
#import <React-RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#import "S2SDemo-Swift.h"

@implementation RCTNativeDdc

+ (NSString *)moduleName
{
  return @"NativeDdc";
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeDdcSpecJSI>(params);
}

- (void)openIframeBridge:(NSString *)url
               timeoutMs:(double)timeoutMs
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  // Zero means "give up now", so the caller must resolve its own default.
  if (timeoutMs <= 0 || url.length == 0) {
    resolve(@"");
    return;
  }

  // WebKit must be driven from the main thread.
  dispatch_async(dispatch_get_main_queue(), ^{
    __block BOOL settled = NO;
    // No strong reference is kept here on purpose: HeadlessWebView holds itself
    // until it has answered, then lets go.
    HeadlessWebView *bridge = [[HeadlessWebView alloc] initWithUrl:url
                                                        timeoutMs:@(timeoutMs)
                                                         callback:^(NSArray *response) {
                                                           if (settled) {
                                                             return;
                                                           }
                                                           settled = YES;
                                                           id message = response.firstObject;
                                                           resolve([message isKindOfClass:[NSString class]] ? message : @"");
                                                         }];
    [bridge startFlow];
  });
}

@end
