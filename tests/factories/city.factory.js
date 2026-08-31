import City from '../../models/city.js';


export async function createCity(overrides = {}) {

    const city = await City.create({
        name: 'São Paulo',
        state: 'SP',
        slug: `sao-paulo-sp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ...overrides
    });

    return city;
}