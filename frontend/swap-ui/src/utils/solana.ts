import {
  Commitment,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  RpcResponseAndContext,
  SimulatedTransactionResponse,
  Transaction
} from '@solana/web3.js';
import { log } from '@neonevm/solana-sign';

export async function solanaAirdrop(connection: Connection, publicKey: PublicKey, lamports: number, commitment: Commitment = 'finalized'): Promise<number> {
  let balance = await connection.getBalance(publicKey);
  if (balance < lamports) {
    const signature = await connection.requestAirdrop(publicKey, lamports);
    await connection.confirmTransaction(signature, commitment);
    balance = await connection.getBalance(publicKey);
  }
  log(`${publicKey.toBase58()} balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  return balance;
}


export async function simulateTransaction(connection: Connection, transaction: Transaction, commitment: Commitment): Promise<RpcResponseAndContext<SimulatedTransactionResponse>> {
  if (!transaction.recentBlockhash) {
    const { blockhash } = await connection.getLatestBlockhash(commitment);
    transaction.recentBlockhash = blockhash;
  }
  const signData = transaction.serializeMessage();
  // @ts-ignore
  const wireTransaction = transaction._serialize(signData);
  const encodedTransaction = wireTransaction.toString('base64');
  const config = { encoding: 'base64', commitment };
  const args = [encodedTransaction, config];

  // @ts-ignore
  const res = await connection._rpcRequest('simulateTransaction', args);
  if (res.error) {
    throw new Error(`failed to simulate transaction: ${res.error.message}`);
  }
  return res.result;
}
