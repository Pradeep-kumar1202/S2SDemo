'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * A card field with a shimmer over it until the field says it is ready.
 *
 * A field is an iframe, and that iframe has to fetch and boot its own copy of
 * the SDK before it can draw an input — which is why a field lands noticeably
 * after the page around it. The SDK reports the end of that with a `ready`
 * event, so the slot holds a placeholder until it fires.
 *
 * The field is mounted the whole time and the shimmer sits *over* it, rather
 * than replacing it: an unmounted field never boots, and one without layout
 * may never size its iframe correctly.
 */
export function ShimmerField({
  render,
  className,
}: {
  /** Renders the field, wiring the handler it must call when ready. */
  render: (onReady: () => void) => React.ReactNode;
  className?: string;
}) {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  // A field that never reports ready would shimmer forever, which reads as a
  // broken page. Well past any real load, show it anyway.
  useEffect(() => {
    if (ready) {
      return;
    }
    const timer = setTimeout(() => setReady(true), 10_000);
    return () => clearTimeout(timer);
  }, [ready]);

  return (
    <div className={className ? `field-slot ${className}` : 'field-slot'}>
      {render(onReady)}
      {ready ? null : <span className="shimmer" aria-hidden="true" />}
    </div>
  );
}
