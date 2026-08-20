// Monta um endereço de texto único a partir do endereço estruturado da loja,
// usado tanto para geocodificação quanto para exibição.
export function buildStoreAddressText(address) {
  if (!address) return null;

  const { street, number, complement, district, city, state, zipCode } = address;

  const parts = [
    [street, number].filter(Boolean).join(', '),
    complement,
    district,
    [city, state].filter(Boolean).join(' - '),
    zipCode,
  ].filter(Boolean);

  return parts.length ? parts.join(', ') : null;
}