import { body, query } from 'express-validator';

const BRAZIL_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

function toSlug(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export const registerValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Nome é obrigatório')
    .isLength({ min: 3 }).withMessage('Nome deve ter pelo menos 3 caracteres'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email é obrigatório')
    .isEmail().withMessage('Email inválido'),

  body('password')
    .notEmpty().withMessage('Senha é obrigatória')
    .isLength({ min: 3 }).withMessage('Senha deve ter pelo menos 3 caracteres'),

];

export const loginValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email é obrigatório')
    .isEmail().withMessage('Email inválido'),

  body('password')
    .notEmpty().withMessage('Senha é obrigatória'),
];

export const createCityValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Nome é obrigatório')
    .isLength({ min: 3 }).withMessage('Nome deve ter pelo menos 3 caracteres'),

  body('state')
      .trim()
      .notEmpty().withMessage('Estado é obrigatório')
      .toUpperCase()
      .isIn(BRAZIL_STATES)
      .withMessage('Estado inválido'),

  body('slug')
    .trim()
    .notEmpty().withMessage('Slug é obrigatório')
    .isLength({ min: 6 }).withMessage('Slug deve ter pelo menos 6 caracteres')
    .custom((slug, { req }) => {
      const name = req.body.name;
      const state = req.body.state;

      if (!name || !state) {
        // name ou state inválidos → deixa as outras regras tratarem
        return true;
      }

      const expectedSlug = `${toSlug(name)}-${state.toLowerCase()}`;

      if (slug !== expectedSlug) {
        throw new Error(`Slug inválido. O esperado é "${expectedSlug}"`);
      }

      return true;
    }),
];
// Status possíveis pro filtro da listagem de riders no admin:
// - pending: accountApprovedAt ainda não preenchido (precisa de revisão)
// - active: aprovado E habilitado (active: true)
// - inactive: desativado pelo admin (active: false), aprovado ou não
// - all (ou omitido): sem filtro de status
const RIDER_STATUS_FILTERS = ['pending', 'active', 'inactive', 'all'];
const STORE_STATUS_FILTERS = ['active', 'inactive', 'all'];

export const listRidersValidator = [
  query('status')
    .optional()
    .isIn(RIDER_STATUS_FILTERS).withMessage(`Status deve ser um de: ${RIDER_STATUS_FILTERS.join(', ')}`),

  query('city')
    .optional()
    .isMongoId().withMessage('Cidade inválida'),

  query('search')
    .optional()
    .trim(),

  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Página deve ser um número inteiro a partir de 1')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limite deve ser um número inteiro entre 1 e 100')
    .toInt(),
];

export const listStoresValidator = [
  query('status')
    .optional()
    .isIn(STORE_STATUS_FILTERS).withMessage(`Status deve ser um de: ${STORE_STATUS_FILTERS.join(', ')}`),

  query('city')
    .optional()
    .isMongoId().withMessage('Cidade inválida'),

  query('search')
    .optional()
    .trim(),

  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Página deve ser um número inteiro a partir de 1')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limite deve ser um número inteiro entre 1 e 100')
    .toInt(),
];

// Status numéricos da entrega (ver models/delivery.js): 0 solicitada,
// 1 aceita, 2 retirada, 3 a caminho, 4 entregue, 5 devolvida, 6 cancelada.
const DELIVERY_STATUS_VALUES = [0, 1, 2, 3, 4, 5, 6];

export const listDeliveriesValidator = [
  query('status')
    .optional()
    .isInt().withMessage(`Status deve ser um número entre 0 e 6`)
    .toInt()
    .custom((value) => DELIVERY_STATUS_VALUES.includes(value))
    .withMessage(`Status deve ser um de: ${DELIVERY_STATUS_VALUES.join(', ')}`),

  query('city')
    .optional()
    .isMongoId().withMessage('Cidade inválida'),

  query('store')
    .optional()
    .isMongoId().withMessage('Loja inválida'),

  query('rider')
    .optional()
    .isMongoId().withMessage('Entregador inválido'),

  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Página deve ser um número inteiro a partir de 1')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limite deve ser um número inteiro entre 1 e 100')
    .toInt(),
];

export const updatePlatformSettingsValidator = [
  body('deliveryFee')
    .optional()
    .isFloat({ min: 0 }).withMessage('Taxa por entrega deve ser um número maior ou igual a 0')
    .toFloat(),

  body('freeDeliveriesPromoActive')
    .optional()
    .isBoolean().withMessage('freeDeliveriesPromoActive deve ser um booleano')
    .toBoolean(),

  body('freeDeliveriesGranted')
    .optional()
    .isInt({ min: 0 }).withMessage('Quantidade de entregas grátis deve ser um número inteiro maior ou igual a 0')
    .toInt(),
];