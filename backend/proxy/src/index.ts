import express, { Express, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
const port = process.env.SERVER_PORT || 3000;
const solanaProxy = createProxyMiddleware({
  target: 'http://195.201.36.140:9090/solana/sol', // target host with the same base path
  changeOrigin: true // needed for virtual hosted sites
});

// app.use(express.static('public'));
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
app.use('/solana/sol', solanaProxy);
app.get('/status', (req: Request, res: Response) => {
  res.json({ status: 'Ok' });
});

app.listen(port, () => console.log(`[server]: Server is running at http://localhost:${port}`));
