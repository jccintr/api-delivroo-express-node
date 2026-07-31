/*
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
*/

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import app from './app.js';
import websocket from './websocket.js';

dotenv.config();

async function start() {
  try {
    // 1. Conecta no banco PRIMEIRO
    await mongoose.connect(process.env.DB_CONNECTION_PROD);
    console.log('Conectado ao banco de dados com sucesso!');

    // 2. Só depois sobe o servidor
    const server = app.listen(process.env.PORT || 3000, () => {
      console.log('Servidor ouvindo a porta ' + (process.env.PORT || 3000));
    });

    // 3. WebSocket depois do server
    const wss = websocket(server);
    app.set('wss', wss);
  } catch (error) {
    console.error('Falha ao iniciar a aplicação:', error);
    process.exit(1); // Railway reinicia o container se falhar
  }
}

start();