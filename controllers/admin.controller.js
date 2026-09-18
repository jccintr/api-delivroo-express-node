import bcryptjs from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';
import { matchedData } from 'express-validator';
import Admin from '../models/admin.js';
import Rider from '../models/rider.js';
import Store from '../models/store.js';
import City from '../models/city.js';
import Delivery from '../models/delivery.js';
import PlatformSettings, { getOrCreatePlatformSettings } from '../models/platformSettings.js';
import { todayBrazilRange } from '../utils/brazilDate.js';
import { sendRiderAccountApprovedEmail } from '../utils/sendEmailV2.js';

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Verifica se o email já existe
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Email já cadastrado.' });
    }

    // Hash da senha
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);
   
    const newAdmin = new Admin({
      name,
      email,
      password: hashedPassword,
    });

    await newAdmin.save();

    const { password: _, ...adminData } = newAdmin._doc;

    return res.status(201).json({
      message: 'Conta criada com sucesso.',
      admin: adminData
    });
  } catch (error) {
    console.error('Erro no register:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email }).select(
      'name email password active'
    );

    if (!admin) {
      return res.status(400).json({ error: 'Email ou senha inválidos.' });
    }

    if (!admin.active) {
      return res.status(403).json({ error: 'Conta desativada.' });
    }

    const isPasswordValid = await bcryptjs.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Email ou senha inválidos.' });
    }

    const token = jsonwebtoken.sign(
      { adminId: admin._id },
      process.env.JWT_SECRET_ADMIN
    );

    const { password: _, ...rest } = admin._doc;

   
    return res.status(200).json({
      ...rest,
      token
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const validateToken = async (req, res) => {
  try {
    const adminId = req.user?.id || req.body.adminId;

    const admin = await Admin.findById(adminId).select(
      'name email active'
    );

    if (!admin) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (!admin.active) {
      return res.status(403).json({ error: 'Conta desativada.' });
    }

    
    return res.status(200).json(admin);
  } catch (error) {
    console.error('Erro no validateToken:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const createAdminUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Verifica se o email já existe
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Email já cadastrado.' });
    }

    // Hash da senha
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);
   
    const newAdmin = new Admin({
      name,
      email,
      password: hashedPassword,
    });

    await newAdmin.save();

    const { password: _, ...adminData } = newAdmin._doc;

    return res.status(201).json({
      message: 'Conta criada com sucesso.',
      admin: adminData
    });
  } catch (error) {
    console.error('Erro no register:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// Aprovar conta do Rider
export const approveRider = async (req, res) => {
  try {
    const { id } = req.params;

    const rider = await Rider.findById(id);

    if (!rider) {
      return res.status(404).json({ error: 'Entregador não encontrado.' });
    }

    if (!rider.documentImage) {
      return res.status(400).json({ error: 'Documento ainda não enviado.' });
    }

    if (rider.accountApprovedAt) {
      return res.status(400).json({ error: 'Conta já aprovada.' });
    }

    rider.accountApprovedAt = new Date();
    await rider.save();

    // Envia e-mail de congratulação (não bloqueia a resposta em caso de falha)
    try {
      await sendRiderAccountApprovedEmail(rider.email, rider.name);
    } catch (mailError) {
      console.error('Erro ao enviar e-mail de aprovação do rider:', mailError);
    }

    const { password: _, ...riderData } = rider._doc;

    return res.status(200).json({
      message: 'Conta aprovada com sucesso.',
      rider: riderData
    });
  } catch (error) {
    console.error('Erro no approveRider:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// Ativar ou desativar conta do Rider
export const setRiderActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'O campo "active" deve ser true ou false.' });
    }

    const rider = await Rider.findById(id);

    if (!rider) {
      return res.status(404).json({ error: 'Entregador não encontrado.' });
    }

    rider.active = active;
    await rider.save();

    const { password: _, ...riderData } = rider._doc;

    return res.status(200).json({
      message: active ? 'Conta ativada com sucesso.' : 'Conta desativada com sucesso.',
      rider: riderData
    });
  } catch (error) {
    console.error('Erro no setRiderActive:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const setStoreActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'O campo "active" deve ser true ou false.' });
    }

    const store = await Store.findById(id);

    if (!store) {
      return res.status(404).json({ error: 'Loja não encontrada.' });
    }

    store.active = active;
    await store.save();

    const { password: _, ...storeData } = store._doc;

    return res.status(200).json({
      message: active ? 'Conta ativada com sucesso.' : 'Conta desativada com sucesso.',
      store: storeData
    });
  } catch (error) {
    console.error('Erro no setStoreActive:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};



// GET /admin/dashboard
// Indicadores gerais da plataforma para a tela inicial do admin — inclui
// o indicador de entregadores com conta pendente de aprovação
// (accountApprovedAt ainda null), que é o dado mais acionável do painel.
export const getDashboardStats = async (req, res) => {
  try {
    const [
      pendingApproval,
      activeRiders,
      inactiveRiders,
      totalRiders,
      activeStores,
      inactiveStores,
      totalStores,
    ] = await Promise.all([
      Rider.countDocuments({ accountApprovedAt: null }),
      Rider.countDocuments({ active: true, accountApprovedAt: { $ne: null } }),
      Rider.countDocuments({ active: false }),
      Rider.countDocuments({}),
      Store.countDocuments({ active: true }),
      Store.countDocuments({ active: false }),
      Store.countDocuments({}),
    ]);

    const today = todayBrazilRange();
    const [deliveriesTodayResult] = await Delivery.aggregate([
      { $match: { createdAt: { $gte: today.start, $lte: today.end } } },
      {
        $group: {
          _id: null,
          requested: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 4] }, 1, 0] } },
          cancelledOrReturned: { $sum: { $cond: [{ $in: ['$status', [5, 6]] }, 1, 0] } },
        },
      },
    ]);

    return res.status(200).json({
      riders: {
        total: totalRiders,
        active: activeRiders,
        inactive: inactiveRiders,
        pendingApproval,
      },
      stores: {
        total: totalStores,
        active: activeStores,
        inactive: inactiveStores,
      },
      deliveriesToday: {
        requested: deliveriesTodayResult?.requested ?? 0,
        completed: deliveriesTodayResult?.completed ?? 0,
        cancelledOrReturned: deliveriesTodayResult?.cancelledOrReturned ?? 0,
      },
    });
  } catch (error) {
    console.error('Erro no getDashboardStats:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// GET /admin/riders
// Lista paginada de entregadores, com filtro por status — 'pending' é o
// que alimenta a fila de aprovação (ver getDashboardStats/approveRider),
// 'active'/'inactive' refletem o campo `active`, e cidade/busca por
// nome-ou-email são complementares para achar um rider específico.
export const listRiders = async (req, res) => {
  try {
    const { status, city, search, page = 1, limit = 20 } = matchedData(req, { locations: ['query'] });

    const filter = {};
    if (city) filter.city = city;
    if (status === 'pending') filter.accountApprovedAt = null;
    if (status === 'active') {
      filter.active = true;
      filter.accountApprovedAt = { $ne: null };
    }
    if (status === 'inactive') filter.active = false;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: regex }, { email: regex }];
    }

    const skip = (page - 1) * limit;
    const [riders, total] = await Promise.all([
      Rider.find(filter)
        .select('-password -resetPasswordCode -resetPasswordCodeExpiresAt -emailVerificationCode')
        .populate('city', 'name state')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Rider.countDocuments(filter),
    ]);

    return res.status(200).json({
      data: riders,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error('Erro no listRiders:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// GET /admin/riders/:id
// Detalhe de um entregador específico — usado na tela de revisão antes de
// aprovar (mostra documentImage) e na tela de detalhe geral.
export const getRider = async (req, res) => {
  try {
    const { id } = req.params;

    const rider = await Rider.findById(id)
      .select('-password -resetPasswordCode -resetPasswordCodeExpiresAt -emailVerificationCode')
      .populate('city', 'name state');

    if (!rider) {
      return res.status(404).json({ error: 'Entregador não encontrado.' });
    }

    return res.status(200).json(rider);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ error: 'Entregador não encontrado.' });
    }
    console.error('Erro no getRider:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// GET /admin/stores
// Lista paginada de lojas, com os mesmos filtros de status/cidade/busca
// da listagem de riders (ativa/inativa/todas + nome-ou-email).
export const listStores = async (req, res) => {
  try {
    const { status, city, search, page = 1, limit = 20 } = matchedData(req, { locations: ['query'] });

    const filter = {};
    if (city) filter.city = city;
    if (status === 'active') filter.active = true;
    if (status === 'inactive') filter.active = false;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: regex }, { email: regex }];
    }

    const skip = (page - 1) * limit;
    const [stores, total] = await Promise.all([
      Store.find(filter)
        .select('-password -resetPasswordCode -resetPasswordCodeExpiresAt -emailVerificationCode')
        .populate('city', 'name state')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Store.countDocuments(filter),
    ]);

    return res.status(200).json({
      data: stores,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error('Erro no listStores:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// GET /admin/stores/:id
export const getStore = async (req, res) => {
  try {
    const { id } = req.params;

    const store = await Store.findById(id)
      .select('-password -resetPasswordCode -resetPasswordCodeExpiresAt -emailVerificationCode')
      .populate('city', 'name state');

    if (!store) {
      return res.status(404).json({ error: 'Loja não encontrada.' });
    }

    return res.status(200).json(store);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ error: 'Loja não encontrada.' });
    }
    console.error('Erro no getStore:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// GET /admin/deliveries
// Monitor de entregas da plataforma inteira (todas as lojas/cidades),
// diferente dos endpoints de loja/rider que só veem o próprio recorte.
// Filtros são todos opcionais e combináveis: status, cidade, loja, rider.
export const listDeliveries = async (req, res) => {
  try {
    const { status, city, store, rider, page = 1, limit = 20 } = matchedData(req, { locations: ['query'] });

    const filter = {};
    if (status !== undefined) filter.status = status;
    if (city) filter.city = city;
    if (store) filter.store = store;
    if (rider) filter.rider = rider;

    const skip = (page - 1) * limit;
    const [deliveries, total] = await Promise.all([
      Delivery.find(filter)
        .populate('store', 'name avatar phone email')
        .populate('rider', 'name phone email avatar vehicle rating')
        .populate('city', 'name state')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Delivery.countDocuments(filter),
    ]);

    return res.status(200).json({
      data: deliveries,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error('Erro no listDeliveries:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// GET /admin/cities
// Lista simples de todas as cidades (ativas e inativas) — usada pra
// popular filtros de cidade nas telas de riders/stores/deliveries.
export const listCities = async (req, res) => {
  try {
    const cities = await City.find().sort({ name: 1 });
    return res.status(200).json(cities);
  } catch (error) {
    console.error('Erro no listCities:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const createCity = async (req, res) => {
  try {
    const { name, state, slug, active, center, radiusKm } = req.body;

   
    // Verifica se já existe cidade com o mesmo slug
    const existingCity = await City.findOne({ slug: slug.toLowerCase().trim() });
    if (existingCity) {
      return res.status(400).json({ error: 'Já existe uma cidade com este slug.' });
    }

    // Monta o objeto da cidade
    const cityData = {
      name: name.trim(),
      state: state.toUpperCase().trim(),
      slug: slug.toLowerCase().trim(),
      active: typeof active === 'boolean' ? active : true
    };

    // Campos opcionais
    if (center && center.latitude != null && center.longitude != null) {
      cityData.center = {
        latitude: center.latitude,
        longitude: center.longitude
      };
    }

    if (radiusKm != null) {
      cityData.radiusKm = radiusKm;
    }

    const city = new City(cityData);
    await city.save();

    return res.status(201).json({
      message: 'Cidade criada com sucesso.',
      city
    });
  } catch (error) {
    console.error('Erro no createCity:', error);

    // Trata erro de unique do MongoDB (caso o índice unique dispare)
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Já existe uma cidade com este slug.' });
    }

    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// GET /admin/platform-settings
// Retorna a configuração global de faturamento vigente (taxa por entrega e
// estado da promoção de entregas grátis). Cria o documento com os valores
// padrão na primeira chamada, se ele ainda não existir.
export const getPlatformSettings = async (req, res) => {
  try {
    const settings = await getOrCreatePlatformSettings();
    return res.status(200).json(settings);
  } catch (error) {
    console.error('Erro no getPlatformSettings:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// PATCH /admin/platform-settings
// Atualiza a configuração global de faturamento. Todos os campos são
// opcionais — só os enviados são alterados. Efeitos práticos:
// - deliveryFee: vale a partir da PRÓXIMA entrega concluída (entregas já
//   concluídas mantêm o valor gravado em delivery.platformFee).
// - freeDeliveriesPromoActive: desativar aqui NÃO mexe no saldo de lojas
//   que já receberam crédito — só passa a zerar o saldo inicial de quem
//   se cadastrar depois (ver register() em store.controller.js).
// - freeDeliveriesGranted: só vale para cadastros futuros, não retroage
//   sobre o saldo já concedido a lojas existentes.
export const updatePlatformSettings = async (req, res) => {
  try {
    const { deliveryFee, freeDeliveriesPromoActive, freeDeliveriesGranted } = matchedData(req, { locations: ['body'] });

    const update = {};
    if (deliveryFee !== undefined) update.deliveryFee = deliveryFee;
    if (freeDeliveriesPromoActive !== undefined) update.freeDeliveriesPromoActive = freeDeliveriesPromoActive;
    if (freeDeliveriesGranted !== undefined) update.freeDeliveriesGranted = freeDeliveriesGranted;

    // Garante que o singleton já existe antes de tentar atualizá-lo.
    await getOrCreatePlatformSettings();

    const settings = await PlatformSettings.findOneAndUpdate(
      {},
      update,
      { returnDocument: 'after' },
    );

    return res.status(200).json(settings);
  } catch (error) {
    console.error('Erro no updatePlatformSettings:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};