import { CSPLToken } from '../models';
import { NeonAddress } from '@neonevm/solana-sign';
import { Contract, JsonRpcProvider } from 'ethers';
import { pancakeSwapAbi } from '../data/pancakeSwap.ts';
import { toFullAmount } from '@neonevm/token-transfer-core';
import { Amount } from '@neonevm/token-transfer-core/dist/types/models';

export async function getTokenExchangeRate(provider: JsonRpcProvider, router: NeonAddress, tokenA: CSPLToken, tokenB: CSPLToken, amount: Amount = 1) {
  const contract = new Contract(router, pancakeSwapAbi, provider);
  console.log(amount);
  const fullAmount = toFullAmount(amount, tokenB.decimals);
  const balance = await contract.getAmountsOut(fullAmount, [tokenA.address, tokenB.address]);
  console.log(balance);
  return balance;
}
