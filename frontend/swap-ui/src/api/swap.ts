import {
  claimTransactionData,
  erc20ForSPLContract,
  neonWrapper2Contract
} from '@neonevm/token-transfer-ethers';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { createApproveInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import {
  createScheduledNeonEvmMultipleTransaction,
  EstimatedScheduledGasPayData,
  GAS_LIMIT_DEFAULT,
  logJson,
  MAX_FEE_PER_GAS_DEFAULT,
  MAX_PRIORITY_FEE_PER_GAS_DEFAULT,
  MultipleTransactions,
  NeonAddress,
  NeonProxyRpcApi,
  NO_CHILD_INDEX,
  ScheduledTransaction
} from '@neonevm/solana-sign';
import {
  authAccountAddress,
  erc20Abi,
  neonWrapper2Abi,
  SPLToken,
  toFullAmount
} from '@neonevm/token-transfer-core';
import { Contract, Interface, JsonRpcProvider, parseUnits } from 'ethers';
import { pancakeSwapAbi } from '../data/pancakeSwap';
import { CSPLToken, SwapTokenCommonData, SwapTokensResponse, TransactionGas } from '../models';

export async function estimateScheduledGas(proxyApi: NeonProxyRpcApi, data: EstimatedScheduledGasPayData): Promise<TransactionGas> {
  let maxFeePerGas = MAX_FEE_PER_GAS_DEFAULT;
  let maxPriorityFeePerGas = MAX_PRIORITY_FEE_PER_GAS_DEFAULT;
  let gasLimit = [GAS_LIMIT_DEFAULT];
  try {
    const { result, error } = await proxyApi.estimateScheduledGas(data);
    logJson(error);
    if (result) {
      logJson(result);
      maxFeePerGas = parseInt(result.maxFeePerGas, 16);
      maxPriorityFeePerGas = parseInt(result.maxPriorityFeePerGas, 16);
      gasLimit = result.gasList.map(i => parseInt(i, 16));
    }
  } catch (e) {
    console.log(e);
  }
  return { gasLimit, maxFeePerGas, maxPriorityFeePerGas };
}

export function transferTokenToNeonTransaction(index: number, data: SwapTokenCommonData): [ScheduledTransaction, TransactionInstruction] {
  const {
    solanaUser,
    tokenFrom,
    chainId,
    amountFrom,
    nonce,
    neonEvmProgram,
    transactionGas
  } = data;

  const fullAmount = toFullAmount(amountFrom, tokenFrom.decimals);
  const tokenATA = getAssociatedTokenAddressSync(new PublicKey(tokenFrom.address_spl), solanaUser.publicKey);
  const climeData = claimTransactionData(tokenATA, solanaUser.neonWallet, fullAmount);

  const transaction = new ScheduledTransaction({
    index: index,
    nonce: nonce,
    payer: solanaUser.neonWallet,
    target: tokenFrom.address,
    callData: climeData,
    chainId: chainId,
    gasLimit: transactionGas.gasLimit[0],
    maxFeePerGas: transactionGas.maxFeePerGas,
    maxPriorityFeePerGas: transactionGas.maxPriorityFeePerGas
  });

  const [delegatePDA] = authAccountAddress(solanaUser.neonWallet, neonEvmProgram, tokenFrom as SPLToken);
  const approve = createApproveInstruction(tokenATA, delegatePDA, solanaUser.publicKey, fullAmount);

  return [transaction, approve];
}

export function approveTokensForSwapTransaction(index: number, data: SwapTokenCommonData): ScheduledTransaction {
  const {
    pancakeRouter,
    amountFrom,
    tokenFrom,
    solanaUser,
    nonce,
    chainId,
    transactionGas
  } = data;

  return new ScheduledTransaction({
    index: index,
    nonce: nonce,
    payer: solanaUser.neonWallet,
    target: tokenFrom.address,
    callData: erc20ForSPLContract().encodeFunctionData('approve', [pancakeRouter, parseUnits(amountFrom.toString(), tokenFrom.decimals)]),
    chainId: chainId,
    gasLimit: transactionGas.gasLimit[0],
    maxFeePerGas: transactionGas.maxFeePerGas,
    maxPriorityFeePerGas: transactionGas.maxPriorityFeePerGas
  });
}

export function pancakeSwapTransaction(index: number, data: SwapTokenCommonData): ScheduledTransaction {
  const {
    transactionGas,
    amountFrom,
    tokenFrom,
    tokenTo,
    solanaUser,
    pancakeRouter,
    nonce,
    chainId
  } = data;
  const pancaceSwapInterface = new Interface(pancakeSwapAbi);
  const fullAmountFrom = toFullAmount(amountFrom, tokenFrom.decimals);
  const deadline = Math.round((Date.now() + 10 * 60 * 1e3) / 1e3);
  const swapData = pancaceSwapInterface.encodeFunctionData('swapExactTokensForTokens', [fullAmountFrom, 0, [tokenFrom.address, tokenTo.address], solanaUser.neonWallet, deadline]);
  return new ScheduledTransaction({
    index: index,
    nonce: nonce,
    payer: solanaUser.neonWallet,
    target: pancakeRouter,
    callData: swapData,
    chainId: chainId,
    gasLimit: transactionGas.gasLimit[0],
    maxFeePerGas: transactionGas.maxFeePerGas,
    maxPriorityFeePerGas: transactionGas.maxPriorityFeePerGas
  });
}

export async function transferTokenToSolanaTransaction(index: number, params: SwapTokenCommonData): Promise<ScheduledTransaction> {
  const { transactionGas, solanaUser, tokenTo, nonce, chainId, provider } = params;
  const contract = new Contract(tokenTo.address, erc20Abi, provider);
  const balance = await contract.balanceOf(solanaUser.neonWallet);
  const ata = getAssociatedTokenAddressSync(new PublicKey(tokenTo.address_spl), solanaUser.publicKey);
  const transferSolanaData = erc20ForSPLContract().encodeFunctionData('transferSolana', [ata.toBuffer(), balance]);

  return new ScheduledTransaction({
    index: index,
    nonce: nonce,
    payer: solanaUser.neonWallet,
    target: tokenTo.address,
    callData: transferSolanaData,
    chainId: chainId,
    gasLimit: transactionGas.gasLimit[0],
    maxFeePerGas: transactionGas.maxFeePerGas,
    maxPriorityFeePerGas: transactionGas.maxPriorityFeePerGas
  });
}

export async function transferWNeonToSolanaTransaction(index: number, params: SwapTokenCommonData): Promise<ScheduledTransaction[]> {
  const { transactionGas, solanaUser, tokenTo, nonce, chainId, provider } = params;
  const wNeonContract = new Contract(tokenTo.address, neonWrapper2Abi, provider);
  const wNeonBalance = await wNeonContract.balanceOf(solanaUser.neonWallet);
  const unwrapNeonData = neonWrapper2Contract().encodeFunctionData('withdraw', [wNeonBalance.toString()]);
  console.log(wNeonBalance, tokenTo.symbol);

  const unwrapNeonTransaction = new ScheduledTransaction({
    index: index,
    nonce: nonce,
    payer: solanaUser.neonWallet,
    target: tokenTo.address,
    callData: unwrapNeonData,
    chainId: chainId,
    gasLimit: transactionGas.gasLimit[0],
    maxFeePerGas: transactionGas.maxFeePerGas,
    maxPriorityFeePerGas: transactionGas.maxPriorityFeePerGas
  });

  return [unwrapNeonTransaction];
}

export function approveTokensMultiple(params: SwapTokenCommonData): SwapTokensResponse {
  const { neonEvmProgram, solanaUser, nonce, chainId, transactionGas } = params;
  const [claimTransaction, approveInstruction] = transferTokenToNeonTransaction(0, params);
  const approveSwapTransaction = approveTokensForSwapTransaction(1, params);
  const swapTransaction = pancakeSwapTransaction(2, params);

  const multiple = new MultipleTransactions(nonce, transactionGas.maxFeePerGas, transactionGas.maxPriorityFeePerGas);
  const transactions: ScheduledTransaction[] = [];

  // Approve clime to trx
  multiple.addTransaction(claimTransaction, 1, 0);
  transactions.push(claimTransaction);

  // Approve swap trx
  multiple.addTransaction(approveSwapTransaction, 2, 1);
  transactions.push(approveSwapTransaction);

  // Pancake Swap trx
  multiple.addTransaction(swapTransaction, NO_CHILD_INDEX, 1);
  transactions.push(swapTransaction);

  // [1] scheduled trxs
  const scheduledTransaction = createScheduledNeonEvmMultipleTransaction({
    chainId: chainId,
    neonEvmProgram: neonEvmProgram,
    neonTransaction: multiple.data,
    signerAddress: solanaUser.publicKey,
    tokenMintAddress: solanaUser.tokenMint,
    neonWallet: solanaUser.neonWallet,
    neonWalletNonce: nonce
  });

  // [0] approve
  scheduledTransaction.instructions.unshift(approveInstruction);
  logJson(transactions.map(d => d.data));

  return {
    scheduledTransaction,
    transactions
  };
}

export async function withdrawTokensMultiple(params: SwapTokenCommonData): Promise<SwapTokensResponse> {
  const { neonEvmProgram, solanaUser, nonce, chainId, transactionGas } = params;
  // const pancakeTransaction = pancakeSwapTransaction(0, params);
  const transferSolanaTransaction = await transferTokenToSolanaTransaction(0, params);

  const transactions: ScheduledTransaction[] = [
    transferSolanaTransaction
  ];

  const multiple = new MultipleTransactions(nonce, transactionGas.maxFeePerGas, transactionGas.maxPriorityFeePerGas);
  // multiple.addTransaction(pancakeTransaction, 1, 0);
  multiple.addTransaction(transferSolanaTransaction, NO_CHILD_INDEX, 0);

  const scheduledTransaction = createScheduledNeonEvmMultipleTransaction({
    chainId: chainId,
    neonEvmProgram: neonEvmProgram,
    neonTransaction: multiple.data,
    signerAddress: solanaUser.publicKey,
    tokenMintAddress: solanaUser.tokenMint,
    neonWallet: solanaUser.neonWallet,
    neonWalletNonce: nonce
  });

  return { scheduledTransaction, transactions };
}

export async function getTokenExchangeRate(provider: JsonRpcProvider, router: NeonAddress, tokenA: CSPLToken, tokenB: CSPLToken, amount = 1) {
  const contract = new Contract(router, pancakeSwapAbi, provider);
  const fullAmount = toFullAmount(amount, tokenB.decimals);
  const balance = await contract.getAmountsOut(fullAmount, [tokenA, tokenB]);
}
