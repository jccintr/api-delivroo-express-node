import dotenv from 'dotenv';
import mongoose from 'mongoose';
import app from './app.js';
import websocket from './websocket.js';

dotenv.config();

async function connectDatabase() {
  try {
    await mongoose.connect(process.env.DB_CONNECTION_PROD);
    console.log('Conectado ao banco de dados com sucesso !');
  } catch (error) {
    console.log('Falha ao conectar ao banco de dados.');
  }
}

connectDatabase();

const server = app.listen(process.env.PORT, () => {
  console.log('Servidor ouvindo a porta ' + process.env.PORT);
});

const wss = websocket(server);
app.set('wss', wss);