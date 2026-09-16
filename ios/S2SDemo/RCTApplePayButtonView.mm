//
//  RCTApplePayButtonView.mm
//  S2SDemo
//

#import "RCTApplePayButtonView.h"

#import <PassKit/PassKit.h>

#import <react/renderer/components/S2SDemoSpec/ComponentDescriptors.h>
#import <react/renderer/components/S2SDemoSpec/EventEmitters.h>
#import <react/renderer/components/S2SDemoSpec/Props.h>
#import <react/renderer/components/S2SDemoSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

@interface RCTApplePayButtonView () <RCTHyperApplePayButtonViewProtocol>
@end

@implementation RCTApplePayButtonView {
  PKPaymentButton *_button;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<HyperApplePayButtonComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const HyperApplePayButtonProps>();
    _props = defaultProps;
    [self rebuildButtonWithProps:*defaultProps];
  }
  return self;
}

// PKPaymentButton's type and style are fixed at init time, so a change to
// either requires a new button instance.
- (void)rebuildButtonWithProps:(const HyperApplePayButtonProps &)props
{
  [_button removeFromSuperview];
  _button = [PKPaymentButton buttonWithType:(PKPaymentButtonType)props.type
                                      style:(PKPaymentButtonStyle)props.buttonStyle];
  _button.cornerRadius = props.buttonBorderRadius;
  _button.enabled = !props.disabled;
  self.contentView = _button;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &oldViewProps = *std::static_pointer_cast<HyperApplePayButtonProps const>(_props);
  const auto &newViewProps = *std::static_pointer_cast<HyperApplePayButtonProps const>(props);

  if (oldViewProps.type != newViewProps.type || oldViewProps.buttonStyle != newViewProps.buttonStyle) {
    [self rebuildButtonWithProps:newViewProps];
  } else {
    if (oldViewProps.buttonBorderRadius != newViewProps.buttonBorderRadius) {
      _button.cornerRadius = newViewProps.buttonBorderRadius;
    }
    if (oldViewProps.disabled != newViewProps.disabled) {
      _button.enabled = !newViewProps.disabled;
    }
  }

  [super updateProps:props oldProps:oldProps];
}

@end

Class<RCTComponentViewProtocol> HyperApplePayButtonCls(void)
{
  return RCTApplePayButtonView.class;
}
