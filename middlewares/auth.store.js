import jsonwebtoken from 'jsonwebtoken';

const AuthStore = (req, res, next) => {
  const bearer = req.headers['authorization'];

  if (!bearer) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const token = bearer.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  try {
    const decoded = jsonwebtoken.verify(token, process.env.JWT_SECRET_STORE);

    // Boa prática: coloca o usuário autenticado em req.user
    req.user = {
      id: decoded.storeId,
      role: 'store'
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
};

export default AuthStore;