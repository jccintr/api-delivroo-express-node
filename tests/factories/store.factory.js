import bcryptjs from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';
import Store from '../../models/store.js';

/**
 * Cria um Rider no banco.
 * @param {object} overrides - campos para sobrescrever os defaults
 * @returns {Promise<import('mongoose').Document>}
 */

export async function createStore(overrides = {}) {

  const password = overrides.password || '123456';
  const hashedPassword = await bcryptjs.hash(password, 10);

  const store = await Store.create({
      name: 'Store Teste',
      email: `store${Date.now()}@test.com`,
      password: hashedPassword,
      phone: '+5511999999999',
      ...overrides,
      password: overrides.password  ? await bcryptjs.hash(overrides.password, 10) : hashedPassword,
 });
  
 return store;

}

/**
 * Cria um Rider + token JWT prontos para usar nos testes autenticados.
 * @param {object} overrides
 * @returns {Promise<{ rider: object, token: string }>}
 */
export async function createStoreWithToken(overrides = {}) {
  const store = await createStore(overrides);

  const token = jsonwebtoken.sign(
    { storeId: store._id },
    process.env.JWT_SECRET_STORE
  );

  return { store, token };
}