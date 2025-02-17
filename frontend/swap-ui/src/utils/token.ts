import { CSPLToken } from '../models';
import { NeonAddress } from '@neonevm/solana-sign';
import { Contract, JsonRpcProvider } from 'ethers';
import { Amount, toFullAmount } from '@neonevm/token-transfer-core';
import { pancakeSwapRouterAbi } from '../data/pancakeSwapRouter';

export async function getTokenExchangeRate(provider: JsonRpcProvider, router: NeonAddress, tokenA: CSPLToken, tokenB: CSPLToken, amount: Amount = 1) {
  const contract = new Contract(router, pancakeSwapRouterAbi, provider);
  console.log(amount);
  const fullAmount = toFullAmount(amount, tokenB.decimals);
  const balance = await contract.getAmountsOut(fullAmount, [tokenA.address, tokenB.address]);
  console.log(balance);
  return balance;
}
