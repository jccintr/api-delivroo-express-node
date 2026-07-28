import express from 'express';
import cors from 'cors';
import router from './routes/index.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: '*' }));

app.get('/', (req, res) => {
  res.send('DELIVRO EXPRESS API');
});

app.use('/api', router);

export default app;