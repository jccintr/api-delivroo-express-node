import { body, query  } from 'express-validator';
import { toBrazilDayStart, toBrazilDayEnd } from '../utils/brazilDate.js';

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

const HISTORY_STATUS_FILTERS = ['delivered', 'returned', 'cancelled'];

// Datas "soltas" (AAAA-MM-DD) no filtro de histórico são ancoradas no dia
// civil de Brasília, não em UTC — sem isso, uma entrega criada à noite
// (horário de Brasília) já vira "o dia seguinte" em UTC e fica fora do
// filtro que a loja esperava ver. Se o chamador já mandar um ISO8601
// completo com hora/offset própria, respeitamos exatamente como veio.
// (toBrazilDayStart/toBrazilDayEnd vivem em utils/brazilDate.js — também
// usados pelo mini-dashboard de estatísticas do rider.)

// GET /stores/deliveries/history — filtro por status (concluída/devolvida/
// cancelada), período (createdAt) e paginação.
//
// Importante: no Express 5, `req.query` é um getter que reparseia a URL a
// cada acesso — então sanitizadores do express-validator (toDate/toInt/
// customSanitizer) NÃO "grudam" em req.query como grudavam no Express 4.
// Por isso a checagem de "to não pode ser antes de from" não pode mais
// viver aqui como um .custom() que lê req.query.from (valor cru, sem
// sanitização) — ela foi movida para o controller, que lê os valores já
// convertidos via matchedData(req) em vez de req.query diretamente.
export const historyQueryValidator = [
  query('status')
    .optional()
    .isIn(HISTORY_STATUS_FILTERS).withMessage(`Status deve ser um de: ${HISTORY_STATUS_FILTERS.join(', ')}`),

    query('from')
    .optional()
    // strict: true rejeita datas com formato certo mas calendário inválido
    // (ex: 2026-04-31, 2026-02-30, 29/fev fora de ano bissexto). No modo
    // padrão (não-strict), isISO8601 só confere o formato via regex e deixa
    // passar essas datas inexistentes — e o `new Date(...)` do JS "conserta"
    // silenciosamente rolando pro mês seguinte, sem erro nenhum.
    .isISO8601({ strict: true }).withMessage('Data inicial inválida ou inexistente (use AAAA-MM-DD)')
    .customSanitizer(toBrazilDayStart),

  query('to')
    .optional()
    .isISO8601({ strict: true }).withMessage('Data final inválida ou inexistente (use AAAA-MM-DD)')
    .customSanitizer(toBrazilDayEnd),

  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Página deve ser um número inteiro a partir de 1')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limite deve ser um número inteiro entre 1 e 100')
    .toInt(),
];