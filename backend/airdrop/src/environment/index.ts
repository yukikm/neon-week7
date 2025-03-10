import dotenv from 'dotenv';
import process from 'node:process';

dotenv.config();

const SOLANA_BANK = process.env.SOLANA_BANK!;
const SOLANA_WALLET = process.env.SOLANA_WALLET!;
const SERVER_PORT = process.env.SERVER_PORT!;
const SOLANA_RPC_MAINNET = process.env.SOLANA_RPC_MAINNET!;
const SOLANA_RPC_DEVNET = process.env.SOLANA_RPC_DEVNET!;
const SOLANA_RPC_LOCALNET = process.env.SOLANA_RPC_LOCALNET!;

export {
  SOLANA_BANK,
  SOLANA_WALLET,
  SERVER_PORT,
  SOLANA_RPC_MAINNET,
  SOLANA_RPC_DEVNET,
  SOLANA_RPC_LOCALNET
};
