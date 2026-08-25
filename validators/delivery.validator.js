import { body } from 'express-validator';

const PACKAGE_CATEGORIES = ['Comida', 'Documentos', 'Pacote', 'Medicamentos', 'Peças', 'Outros'];
const PAYMENT_METHODS = ['Dinheiro', 'Cartão Crédito', 'Cartão Débito', 'Pago', 'Nada a Pagar'];

export const createDeliveryValidator = [
  body('destino')
    .notEmpty().withMessage('Dados do destinatário são obrigatórios')
    .isObject().withMessage('Dados do destinatário inválidos'),

  body('destino.nome')
    .trim()
    .notEmpty().withMessage('Nome do destinatário é obrigatório'),

  body('destino.telefone')
    .trim()
    .notEmpty().withMessage('Telefone do destinatário é obrigatório'),

  body('destino.address')
    .trim()
    .notEmpty().withMessage('Endereço de entrega é obrigatório')
    .isLength({ min: 8 }).withMessage('Informe um endereço completo (rua, número, bairro, cidade)'),

  body('package')
    .notEmpty().withMessage('Dados do pacote são obrigatórios')
    .isObject().withMessage('Dados do pacote inválidos'),

  body('package.description')
    .trim()
    .notEmpty().withMessage('Descrição do pacote é obrigatória'),

  body('package.category')
    .optional()
    .isIn(PACKAGE_CATEGORIES).withMessage('Categoria inválida'),

  body('package.quantity')
    .optional()
    .isInt({ min: 1 }).withMessage('Quantidade deve ser pelo menos 1'),

  body('package.weight')
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('Peso inválido'),

  body('package.declaredvalue')
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('Valor declarado inválido'),

  body('package.notes')
    .optional({ nullable: true })
    .trim(),

  body('package.payment')
    .optional()
    .isIn(PAYMENT_METHODS).withMessage('Forma de pagamento inválida'),

  body('package.amountDue')
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('Valor a receber do cliente inválido'),

  body('package.cashChange')
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('Valor de troco inválido'),

  body('destino.latitude')
    .notEmpty().withMessage('Latitude do endereço de entrega é obrigatória')
    .isFloat({ min: -90, max: 90 }).withMessage('Latitude do destino inválida')
    .toFloat()
    .custom((value) => {
        if (value === 0) {
          throw new Error('Latitude do destino não pode ser zero');
        }
        return true;
        }
  ),
    

  body('destino.longitude')
    .notEmpty().withMessage('Longitude do endereço de entrega é obrigatória')
    .isFloat({ min: -180, max: 180 }).withMessage('Longitude do destino inválida')
    .toFloat()
    .custom((value) => {
        if (value === 0) {
          throw new Error('Longitude do destino não pode ser zero');
        }
        return true;
        }
  ),
];

// Usado por qualquer transição que exija justificativa: devolução (rider),
// cancelamento pelo rider (antes da retirada) e cancelamento pela loja.
export const deliveryReasonValidator = [
  body('motivo')
    .trim()
    .notEmpty().withMessage('Motivo é obrigatório')
    .isLength({ min: 3 }).withMessage('Descreva o motivo com um pouco mais de detalhe'),
];