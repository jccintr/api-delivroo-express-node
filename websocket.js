
import { WebSocketServer,WebSocket } from 'ws';
import jsonwebtoken from 'jsonwebtoken';



function verifyClient(info,callback){
       return callback(true);
}


const websocket = (server) => {

  const wss = new WebSocketServer({server});

  
wss.on('connection', (ws, req) => {
 
   console.log('cliente conectado ao ws');
  
   const token = req.url.substring(1);
   console.log('token do cliente',token);


  //  try {
    
  //  } catch (error) {
    
  //  }
   const decoded = jsonwebtoken.verify(token,process.env.JWT_SECRET_PASSENGER);
   ws.id = decoded.passengerId;

  
 


  ws.on('message', (msg, isBinary) => {
      wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
              client.send(msg, { binary: isBinary });
          }
      });
  });

  ws.on('close', () => {
      console.log('WS Connection closed');
  });

});

  return wss;
}

export default websocket;

