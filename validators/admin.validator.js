import { body } from 'express-validator';

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