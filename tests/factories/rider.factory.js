import bcryptjs from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';
import Rider from '../../models/rider.js';
import City from '../../models/city.js';
import { createCity } from './city.factory.js';
/**
 * Cria um Rider no banco.
 * @param {object} overrides - campos para sobrescrever os defaults
 * @returns {Promise<import('mongoose').Document>}
 */

export async function createRider(overrides = {}) {

  const password = overrides.password || '123456';
  const hashedPassword = await bcryptjs.hash(password, 10);


  const city = await createCity();
  /*
   || await City.create({
      name: 'São Paulo',
      state: 'SP',
      slug: 'sao-paulo-sp',
  });*/
  

  const rider = await Rider.create({
      name: 'Rider Teste',
      email: `rider${Date.now()}@test.com`,
      password: hashedPassword,
      phone: '+5511999999999',
      vehicle: { type: 'Moto' },
      city: city._id,
      ...overrides,
      password: overrides.password  ? await bcryptjs.hash(overrides.password, 10) : hashedPassword,
 });
  
 return rider;

}

/**
 * Cria um Rider + token JWT prontos para usar nos testes autenticados.
 * @param {object} overrides
 * @returns {Promise<{ rider: object, token: string }>}
 */
export async function createRiderWithToken(overrides = {}) {
  const rider = await createRider(overrides);

  const token = jsonwebtoken.sign(
    { riderId: rider._id },
    process.env.JWT_SECRET_RIDER
  );

  return { rider, token };
}