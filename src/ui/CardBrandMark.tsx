/** Small brand badge for a card network, drawn with CSS so there are no assets. */
export function CardBrandMark({ network }: { network?: string | null }) {
  const brand = (network ?? '').toLowerCase();

  if (brand.includes('master')) {
    return (
      <span className="brand brand-mastercard" aria-hidden>
        <i /> <i />
      </span>
    );
  }
  if (brand.includes('visa')) {
    return <span className="brand brand-visa">VISA</span>;
  }
  if (brand.includes('american') || brand.includes('amex')) {
    return <span className="brand brand-amex">AMEX</span>;
  }
  if (brand === 'google_pay') {
    return <span className="brand brand-wallet">G Pay</span>;
  }
  if (brand === 'apple_pay') {
    return <span className="brand brand-apple">Pay</span>;
  }
  return <span className="brand brand-generic">{(network ?? 'Card').slice(0, 4)}</span>;
}
