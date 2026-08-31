// controllers/city.controller.js
import City from '../models/city.js';

// GET /api/cities  — público, só cidades ativas
export const listActiveCities = async (req, res) => {
  try {
    const cities = await City.find({ active: true })
      .select('name state slug')
      .sort({ name: 1 });

    return res.status(200).json(cities);
  } catch (error) {
    console.error('Erro no listActiveCities:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};