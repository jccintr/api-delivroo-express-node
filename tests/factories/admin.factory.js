import bcryptjs from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';
import Admin from '../../models/admin.js';


let counter = 0;

/**
 * Cria um Admin no banco.
 * @param {object} overrides - campos para sobrescrever os defaults
 * @returns {Promise<import('mongoose').Document>}
 */
export async function createAdmin(overrides = {}) {
  counter += 1;

  const password = overrides.password || '123456';
  const hashedPassword = await bcryptjs.hash(password, 10);

  const admin = await Admin.create({
    name: `Admin Teste`,
    email: `admin${Date.now()}@test.com`,
    password: hashedPassword,
    active: true,
    ...overrides,
    // garante que a senha enviada em overrides também seja hasheada
    password: overrides.password
      ? await bcryptjs.hash(overrides.password, 10)
      : hashedPassword,
  });

  return admin;
}

/**
 * Cria um Admin + token JWT prontos para usar nos testes autenticados.
 * @param {object} overrides
 * @returns {Promise<{ admin: object, token: string }>}
 */
export async function createAdminWithToken(overrides = {}) {
  const admin = await createAdmin(overrides);

  const token = jsonwebtoken.sign(
    { adminId: admin._id },
    process.env.JWT_SECRET_ADMIN
  );

  return { admin, token };
}