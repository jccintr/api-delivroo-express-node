import { body, param, query } from 'express-validator';

const objectId = (field, location = param) =>
  location(field).isMongoId().withMessage('Identificador inválido');

// ---------- Loja ----------
export const createRechargeOrderValidator = [
  body('packageId')
    .notEmpty().withMessage('Escolha um pacote')
    .bail()
    .isMongoId().withMessage('Pacote inválido'),
];

export const rechargeOrderIdValidator = [objectId('id')];

export const informPaymentValidator = [
  objectId('id'),
  body('payerNote')
    .optional({ values: 'falsy' })
    .isString().withMessage('Observação inválida')
    .trim()
    .isLength({ max: 200 }).withMessage('Observação deve ter no máximo 200 caracteres'),
];

export const pageQueryValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('page deve ser um inteiro maior que 0').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit deve estar entre 1 e 100').toInt(),
];

// ---------- Admin ----------
const priceRule = (chain) =>
  chain
    .isFloat({ min: 0.01, max: 100000 }).withMessage('Preço deve estar entre R$ 0,01 e R$ 100.000,00')
    .bail()
    .custom((value) => Math.abs(Math.round(Number(value) * 100) - Number(value) * 100) < 1e-6)
    .withMessage('Preço deve ter no máximo 2 casas decimais')
    .toFloat();

export const createPackageValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Nome é obrigatório')
    .isLength({ max: 60 }).withMessage('Nome deve ter no máximo 60 caracteres'),
  body('deliveries')
    .isInt({ min: 1, max: 100000 }).withMessage('Quantidade de entregas deve ser um inteiro entre 1 e 100000')
    .toInt(),
  priceRule(body('price')),
  body('active').optional().isBoolean().withMessage('active deve ser booleano').toBoolean(),
];

export const updatePackageValidator = [
  objectId('id'),
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Nome não pode ficar vazio')
    .isLength({ max: 60 }).withMessage('Nome deve ter no máximo 60 caracteres'),
  body('deliveries')
    .optional()
    .isInt({ min: 1, max: 100000 }).withMessage('Quantidade de entregas deve ser um inteiro entre 1 e 100000')
    .toInt(),
  priceRule(body('price').optional()),
  body('active').optional().isBoolean().withMessage('active deve ser booleano').toBoolean(),
];

export const packageIdValidator = [objectId('id')];

export const listRechargeOrdersValidator = [
  ...pageQueryValidator,
  query('status')
    .optional()
    .isIn(['pending', 'informed', 'confirmed', 'rejected', 'cancelled', 'open'])
    .withMessage('Status inválido'),
  query('store').optional().isMongoId().withMessage('Loja inválida'),
];

export const rejectRechargeOrderValidator = [
  objectId('id'),
  body('reason')
    .trim()
    .notEmpty().withMessage('Informe o motivo')
    .isLength({ min: 3, max: 200 }).withMessage('Motivo deve ter entre 3 e 200 caracteres'),
];

export const adjustCreditsValidator = [
  objectId('id'),
  body('delta')
    .isInt({ min: -100000, max: 100000 }).withMessage('Ajuste deve ser um inteiro entre -100000 e 100000')
    .bail()
    .custom((value) => Number(value) !== 0).withMessage('Ajuste não pode ser zero')
    .toInt(),
  body('note')
    .trim()
    .notEmpty().withMessage('Informe o motivo do ajuste')
    .isLength({ min: 3, max: 200 }).withMessage('Motivo deve ter entre 3 e 200 caracteres'),
];
