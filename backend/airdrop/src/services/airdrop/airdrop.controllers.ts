import { NextFunction, Request, Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import { transferTokens } from '@utils/tokens';
import { solanaConnection } from '@utils/solana';

const storage = new Map<string, number>();
const TRANSACTION_INTERVAL = 60;

export async function airdropTransaction(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const { wallet, amount, token, stand } = req.body;
    const connection = solanaConnection(stand);
    const walletAddress = new PublicKey(wallet);
    const tokenAddress = new PublicKey(token);
    if (storage.has(wallet)) {
      const lastTrx = storage.get(wallet)!;
      const now = Math.round(Date.now() / 1e3);
      if (lastTrx > (now - TRANSACTION_INTERVAL)) {
        throw new Error(`Request limit exceeded`);
      }
    }
    const transaction = await transferTokens(connection, walletAddress, tokenAddress, amount);
    res.status(200).json({ transaction });
    storage.set(wallet, Math.round(Date.now() / 1e3));
  } catch (err: any) {
    console.log(err.message);
    res.status(400).json({ message: err?.message });
  }
}
