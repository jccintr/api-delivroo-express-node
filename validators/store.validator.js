import { body } from 'express-validator';

const BRAZIL_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export const registerStoreValidator = [
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

  body('phone')
    .trim()
    .notEmpty().withMessage('Telefone é obrigatório'),

  
];

export const accountVerificationValidator = [
  body('code')
    .trim()
    .notEmpty().withMessage('Código de verificação é obrigatório')
    .isString().withMessage('Código de verificação deve ser uma string')
];

export const resetPasswordValidator = [
 
  body('email')
    .trim()
    .notEmpty().withMessage('Email é obrigatório')
    .isEmail().withMessage('Email inválido'),

    body('code')
    .notEmpty().withMessage('Código é obrigatório'),
    

  body('password')
    .notEmpty().withMessage('Senha é obrigatória')
    .isLength({ min: 3 }).withMessage('Senha deve ter pelo menos 3 caracteres'),

 
];

export const updateProfileValidator = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3 })
    .withMessage('Nome deve ter pelo menos 3 caracteres.'),

  body('phone')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Telefone inválido.'),

  body('doc')
    .optional({ nullable: true })
    .trim(),

  body('address')
    .optional({ nullable: true })
    .isObject()
    .withMessage('Address deve ser um objeto.'),

  body('address.street').optional({ nullable: true }).trim().isString(),
  body('address.number').optional({ nullable: true }).trim().isString(),
  body('address.complement').optional({ nullable: true }).trim().isString(),
  body('address.district').optional({ nullable: true }).trim().isString(),
  body('address.city').optional({ nullable: true }).trim().isString(),

  body('address.state')
    .optional({ nullable: true })
    .trim()
    .toUpperCase()
    .isIn(BRAZIL_STATES)
    .withMessage('Estado inválido.'),

  body('address.zipCode').optional({ nullable: true }).trim().isString(),
  body('address.latitude').optional({ nullable: true }).isFloat().withMessage('Latitude inválida.'),
  body('address.longitude').optional({ nullable: true }).isFloat().withMessage('Longitude inválida.'),
];