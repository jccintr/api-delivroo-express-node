// Monta um endereço de texto único a partir do endereço estruturado da loja
// + dados da cidade (model City). Usado para geocodificação e exibição.
//
// address: { street, number, complement, district, zipCode, latitude?, longitude? }
// city:    { name, state }  (documento City populado ou objeto simples)
export function buildStoreAddressText(address, city) {
  if (!address) return null;

  const { street, number, complement, district, zipCode } = address;
  const cityName = city?.name;
  const state = city?.state;

  const parts = [
    [street, number].filter(Boolean).join(', '),
    complement,
    district,
    [cityName, state].filter(Boolean).join(' - '),
    zipCode,
  ].filter(Boolean);

  return parts.length ? parts.join(', ') : null;
}