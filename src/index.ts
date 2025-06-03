import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT;

app.use(express.json());

app.get('/', (_req, res) => {
  res.send('Hello from Express + TypeScript + PostgreSQL!');
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
