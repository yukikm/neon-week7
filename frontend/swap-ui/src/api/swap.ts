import {
  claimTransactionData,
  erc20ForSPLContract,
  mintNeonTransactionData
} from '@neonevm/token-transfer-ethers';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { createApproveInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import {
  createScheduledNeonEvmMultipleTransaction,
  createScheduledNeonEvmTransaction,
  delay,
  EstimatedScheduledGasPayData,
  EstimateScheduledTransaction,
  GAS_LIMIT_DEFAULT,
  logJson,
  MAX_FEE_PER_GAS_DEFAULT,
  MAX_PRIORITY_FEE_PER_GAS_DEFAULT,
  MultipleTransactions,
  NeonAddress,
  NeonProxyRpcApi,
  NO_CHILD_INDEX,
  ScheduledTransaction,
  ScheduledTreeAccount,
  SolanaAddress
} from '@neonevm/solana-sign';
import { authAccountAddress, erc20Abi, SPLToken, toFullAmount } from '@neonevm/token-transfer-core';
import { Contract, Interface, parseUnits } from 'ethers';
import { pancakeSwapAbi } from '../data/pancakeSwap';
import {
  SwapTokenCommonData,
  SwapTokenMultipleData,
  SwapTokensData,
  SwapTokensResponse,
  TransactionGas,
  TransferTokenData,
  TransferTokenToSolanaData
} from '../models';

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

export async function swapTokens(data: SwapTokenMultipleData): Promise<SwapTokensResponse> {
  const {
    proxyApi,
    solanaUser,
    nonce,
    amountFrom,
    amountTo,
    tokenFrom,
    tokenTo,
    chainId,
    neonEvmProgram,
    pancakeRouter
  } = data;

  // one
  const tokenFromATA = getAssociatedTokenAddressSync(new PublicKey(tokenFrom.address_spl), solanaUser.publicKey);
  const climeToData = claimTransactionData(tokenFromATA, solanaUser.neonWallet, amountFrom);

  // two
  const pancaceSwapInterface = new Interface(pancakeSwapAbi);
  const fullAmountFrom = toFullAmount(amountFrom, tokenFrom.decimals);
  // const fullAmountTo = toFullAmount(amountTo, tokenTo.decimals);
  const time = (Date.now() + 10 * 60 * 1e3);
  const swapData = pancaceSwapInterface.encodeFunctionData('swapExactTokensForTokens', [fullAmountFrom, 0n, [tokenFrom.address, tokenTo.address], solanaUser.neonWallet, time]);
  console.log(swapData);

  // three
  const tokenToATA = getAssociatedTokenAddressSync(new PublicKey(tokenTo.address_spl), solanaUser.publicKey);
  const transferSolanaData = mintNeonTransactionData(tokenToATA, tokenTo as SPLToken, amountTo);

  const { maxFeePerGas, maxPriorityFeePerGas, gasLimit } = await estimateScheduledGas(proxyApi, {
    scheduledSolanaPayer: solanaUser.publicKey.toBase58(),
    transactions: [{
      from: solanaUser.neonWallet,
      to: tokenFrom.address,
      data: climeToData
    }, {
      from: solanaUser.neonWallet,
      to: pancakeRouter,
      data: swapData
    }, {
      from: solanaUser.neonWallet,
      to: tokenTo.address,
      data: transferSolanaData
    }]
  });

  const transactionSendTokenA = new ScheduledTransaction({
    nonce: nonce,
    payer: solanaUser.neonWallet,
    index: 0,
    target: tokenFrom.address,
    callData: climeToData,
    gasLimit: gasLimit[0],
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFeePerGas,
    chainId: chainId
  });

  const transactionSwapTokensAtoB = new ScheduledTransaction({
    nonce: nonce,
    payer: solanaUser.neonWallet,
    index: 1,
    target: pancakeRouter,
    callData: swapData,
    gasLimit: gasLimit[1],
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFeePerGas,
    chainId: chainId
  });

  const transactionSendTokenB = new ScheduledTransaction({
    nonce: nonce,
    payer: solanaUser.neonWallet,
    index: 2,
    target: tokenTo.address,
    callData: transferSolanaData,
    gasLimit: gasLimit[2],
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFeePerGas,
    chainId: chainId
  });

  const multiple = new MultipleTransactions(nonce, maxFeePerGas);
  multiple.addTransaction(transactionSendTokenA, 1, 0);
  multiple.addTransaction(transactionSwapTokensAtoB, 2, 1);
  multiple.addTransaction(transactionSendTokenB, NO_CHILD_INDEX, 1);

  // [1] scheduled trx
  const scheduledTransaction = createScheduledNeonEvmMultipleTransaction({
    chainId: chainId,
    neonEvmProgram: neonEvmProgram,
    neonTransaction: multiple.data,
    signerAddress: solanaUser.publicKey,
    tokenMintAddress: solanaUser.tokenMint,
    neonWallet: solanaUser.neonWallet,
    neonWalletNonce: nonce
  });

  return {
    scheduledTransaction,
    transactions: [
      transactionSendTokenA,
      transactionSwapTokensAtoB,
      transactionSendTokenB
    ]
  };
}

export async function transferTokenToNeonEvm(data: TransferTokenData): Promise<Transaction> {
  const {
    proxyApi,
    solanaUser,
    neonEvmProgram,
    token,
    chainId,
    amount,
    nonce
  } = data;

  const fullAmount = toFullAmount(amount, token.decimals);
  const tokenATA = getAssociatedTokenAddressSync(new PublicKey(token.address_spl), solanaUser.publicKey);
  const climeData = claimTransactionData(tokenATA, solanaUser.neonWallet, fullAmount);

  const { maxFeePerGas, maxPriorityFeePerGas, gasLimit } = await estimateScheduledGas(proxyApi, {
    scheduledSolanaPayer: solanaUser.publicKey.toBase58(),
    transactions: [{
      from: solanaUser.neonWallet,
      to: token.address,
      data: climeData
    }]
  });

  const transaction = new ScheduledTransaction({
    nonce: nonce,
    payer: solanaUser.neonWallet,
    target: token.address,
    callData: climeData,
    chainId: chainId
  });
  transaction.setGasPrice({
    gasLimit: gasLimit[0],
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFeePerGas
  });

  return createScheduledNeonEvmTransaction({
    chainId: chainId,
    signerAddress: solanaUser.publicKey,
    tokenMintAddress: solanaUser.tokenMint,
    neonEvmProgram: neonEvmProgram,
    neonWallet: solanaUser.neonWallet,
    neonWalletNonce: nonce,
    neonTransaction: transaction.serialize()
  });
}

export async function approveToken(data: SwapTokensData): Promise<Transaction> {
  const {
    proxyApi,
    solanaUser,
    neonEvmProgram,
    tokenFrom,
    chainId,
    amount,
    nonce,
    // pancakeRouter,
    pancakePair
  } = data;

  const approveData = erc20ForSPLContract().encodeFunctionData('approve', [pancakePair, parseUnits(amount.toString(), tokenFrom.decimals)]);

  const { maxFeePerGas, maxPriorityFeePerGas, gasLimit } = await estimateScheduledGas(proxyApi, {
    scheduledSolanaPayer: solanaUser.publicKey.toBase58(),
    transactions: [{
      from: solanaUser.neonWallet,
      to: tokenFrom.address,
      data: approveData
    }]
  });

  const transaction = new ScheduledTransaction({
    nonce: nonce,
    payer: solanaUser.neonWallet,
    target: tokenFrom.address,
    callData: approveData,
    chainId: chainId
  });
  transaction.setGasPrice({
    gasLimit: gasLimit[0],
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFeePerGas
  });

  return createScheduledNeonEvmTransaction({
    chainId: chainId,
    signerAddress: solanaUser.publicKey,
    tokenMintAddress: solanaUser.tokenMint,
    neonEvmProgram: neonEvmProgram,
    neonWallet: solanaUser.neonWallet,
    neonWalletNonce: nonce,
    neonTransaction: transaction.serialize()
  });
}

export async function approveTokens(data: SwapTokensData): Promise<SwapTokensResponse> {
  const {
    proxyApi,
    solanaUser,
    neonEvmProgram,
    tokenFrom,
    tokenTo,
    chainId,
    amount,
    nonce,
    pancakeRouter,
    pancakePair
  } = data;

  // const approvePairData = erc20ForSPLContract().encodeFunctionData('approve', [pancakePair, parseUnits(amount.toString(), tokenFrom.decimals)]);
  const approveTokenFromData = erc20ForSPLContract().encodeFunctionData('approve', [pancakeRouter, parseUnits(amount.toString(), tokenFrom.decimals)]);
  const approveTokenToData = erc20ForSPLContract().encodeFunctionData('approve', [pancakeRouter, parseUnits(amount.toString(), tokenTo.decimals)]);
  const approvePairFromData = erc20ForSPLContract().encodeFunctionData('approve', [pancakePair, parseUnits(amount.toString(), tokenFrom.decimals)]);
  const approvePairToData = erc20ForSPLContract().encodeFunctionData('approve', [pancakePair, parseUnits(amount.toString(), tokenTo.decimals)]);

  const transactions: EstimateScheduledTransaction[] = [
    {
      from: solanaUser.neonWallet,
      to: tokenFrom.address,
      data: approveTokenFromData
    },
    {
      from: solanaUser.neonWallet,
      to: tokenTo.address,
      data: approveTokenToData
    },
    {
      from: solanaUser.neonWallet,
      to: tokenFrom.address,
      data: approvePairFromData
    },
    {
      from: solanaUser.neonWallet,
      to: tokenTo.address,
      data: approvePairToData
    }
  ];

  const { maxFeePerGas, maxPriorityFeePerGas, gasLimit } = await estimateScheduledGas(proxyApi, {
    scheduledSolanaPayer: solanaUser.publicKey.toBase58(),
    transactions
  });

  const multiple = new MultipleTransactions(nonce, maxFeePerGas, maxPriorityFeePerGas);
  const scheduledTransactions: ScheduledTransaction[] = [];
  for (let i = 0; i < transactions.length; i++) {
    const trx = transactions[i];
    const scheduledTransaction = new ScheduledTransaction({
      index: i,
      nonce: nonce,
      payer: trx.from,
      target: trx.to,
      callData: trx.data,
      chainId: chainId,
      gasLimit: gasLimit[i],
      maxFeePerGas: maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFeePerGas
    });
    multiple.addTransaction(scheduledTransaction, NO_CHILD_INDEX, 0);
    scheduledTransactions.push(scheduledTransaction);
  }

  // [1] scheduled trx
  const scheduledTransaction = createScheduledNeonEvmMultipleTransaction({
    chainId: chainId,
    neonEvmProgram: neonEvmProgram,
    neonTransaction: multiple.data,
    signerAddress: solanaUser.publicKey,
    tokenMintAddress: solanaUser.tokenMint,
    neonWallet: solanaUser.neonWallet,
    neonWalletNonce: nonce
  });

  return {
    scheduledTransaction,
    transactions: scheduledTransactions
  };
}

export async function pancakeTokensSwap(data: SwapTokensData): Promise<Transaction> {
  const {
    proxyApi,
    solanaUser,
    neonEvmProgram,
    tokenFrom,
    tokenTo,
    chainId,
    amount,
    nonce,
    pancakeRouter
  } = data;

  const pancaceSwapInterface = new Interface(pancakeSwapAbi);
  const fullAmountFrom = toFullAmount(amount, tokenFrom.decimals);
  const deadline = Math.round((Date.now() + 60 * 60 * 1e3) / 1e3);
  const swapData = pancaceSwapInterface.encodeFunctionData('swapExactTokensForTokens', [fullAmountFrom, 0, [tokenFrom.address, tokenTo.address], solanaUser.neonWallet, deadline]);

  const { maxFeePerGas, maxPriorityFeePerGas, gasLimit } = await estimateScheduledGas(proxyApi, {
    scheduledSolanaPayer: solanaUser.publicKey.toBase58(),
    transactions: [{
      from: solanaUser.neonWallet,
      to: pancakeRouter,
      data: swapData
    }]
  });

  const transaction = new ScheduledTransaction({
    nonce: nonce,
    payer: solanaUser.neonWallet,
    target: pancakeRouter,
    callData: swapData,
    chainId: chainId
  });
  transaction.setGasPrice({
    gasLimit: gasLimit[0],
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFeePerGas
  });

  return createScheduledNeonEvmTransaction({
    chainId: chainId,
    signerAddress: solanaUser.publicKey,
    tokenMintAddress: solanaUser.tokenMint,
    neonEvmProgram: neonEvmProgram,
    neonWallet: solanaUser.neonWallet,
    neonWalletNonce: nonce,
    neonTransaction: transaction.serialize()
  });
}

export async function handleTokensBack(params: TransferTokenToSolanaData): Promise<Transaction> {
  const { provider, neonEvmProgram, proxyApi, solanaUser, token, nonce, chainId } = params;
  const contract = new Contract(token.address, erc20Abi, provider);
  const balance = await contract.balanceOf(solanaUser.neonWallet);
  const ata = getAssociatedTokenAddressSync(new PublicKey(token.address_spl), solanaUser.publicKey);
  const data = erc20ForSPLContract().encodeFunctionData('transferSolana', [ata.toBuffer(), balance]);
  const { maxFeePerGas, maxPriorityFeePerGas, gasLimit } = await estimateScheduledGas(proxyApi, {
    scheduledSolanaPayer: solanaUser.publicKey.toBase58(),
    transactions: [{
      from: solanaUser.neonWallet,
      to: token.address,
      data
    }]
  });

  const scheduledTransaction = new ScheduledTransaction({
    nonce: nonce,
    payer: solanaUser.neonWallet,
    target: token.address,
    callData: data,
    chainId: chainId
  });
  scheduledTransaction.setGasPrice({
    gasLimit: gasLimit[0],
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFeePerGas
  });

  return createScheduledNeonEvmTransaction({
    chainId: chainId,
    signerAddress: solanaUser.publicKey,
    tokenMintAddress: solanaUser.tokenMint,
    neonEvmProgram: neonEvmProgram,
    neonWallet: solanaUser.neonWallet,
    neonWalletNonce: nonce,
    neonTransaction: scheduledTransaction.serialize()
  });
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

export function approveTokensForSwapTransaction(index: number, data: SwapTokenCommonData): ScheduledTransaction[] {
  const {
    pancakeRouter,
    pancakePair,
    amountFrom,
    amountTo,
    tokenFrom,
    tokenTo,
    solanaUser,
    nonce,
    chainId,
    transactionGas
  } = data;

  const transactions: EstimateScheduledTransaction[] = [
    {
      to: tokenFrom.address,
      data: erc20ForSPLContract().encodeFunctionData('approve', [pancakeRouter, parseUnits(amountFrom.toString(), tokenFrom.decimals)])
    },
    {
      to: tokenTo.address,
      data: erc20ForSPLContract().encodeFunctionData('approve', [pancakeRouter, parseUnits(amountTo.toString(), tokenTo.decimals)])
    },
    {
      to: tokenFrom.address,
      data: erc20ForSPLContract().encodeFunctionData('approve', [pancakePair, parseUnits(amountFrom.toString(), tokenFrom.decimals)])
    },
    {
      to: tokenTo.address,
      data: erc20ForSPLContract().encodeFunctionData('approve', [pancakePair, parseUnits(amountTo.toString(), tokenTo.decimals)])
    }
  ];

  const scheduledTransactions: ScheduledTransaction[] = [];
  for (let i = 0; i < transactions.length; i++) {
    const trx = transactions[i];
    const scheduledTransaction = new ScheduledTransaction({
      index: index + i,
      nonce: nonce,
      payer: solanaUser.neonWallet,
      target: trx.to,
      callData: trx.data,
      chainId: chainId,
      gasLimit: transactionGas.gasLimit[i],
      maxFeePerGas: transactionGas.maxFeePerGas,
      maxPriorityFeePerGas: transactionGas.maxPriorityFeePerGas
    });
    scheduledTransactions.push(scheduledTransaction);
  }

  return scheduledTransactions;
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

export function transferTokenToSolanaTransaction(index: number, params: SwapTokenCommonData): ScheduledTransaction {
  const { transactionGas, amountTo, solanaUser, tokenTo, nonce, chainId } = params;
  const fullAmount = toFullAmount(amountTo, tokenTo.decimals);
  const ata = getAssociatedTokenAddressSync(new PublicKey(tokenTo.address_spl), solanaUser.publicKey);
  const transferSolanaData = erc20ForSPLContract().encodeFunctionData('transferSolana', [ata.toBuffer(), fullAmount]);

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

export function approveTokensMultiple(params: SwapTokenCommonData): SwapTokensResponse {
  const { neonEvmProgram, solanaUser, nonce, chainId, transactionGas } = params;
  const [claimTransaction, approveInstruction] = transferTokenToNeonTransaction(0, params);
  const transactions = approveTokensForSwapTransaction(1, params);

  const multiple = new MultipleTransactions(nonce, transactionGas.maxFeePerGas, transactionGas.maxPriorityFeePerGas);
  const scheduledTransactions: ScheduledTransaction[] = [];

  // Approve clime to tx
  multiple.addTransaction(claimTransaction, NO_CHILD_INDEX, 0) // <- должна выполниться первой
  scheduledTransactions.push(claimTransaction);
  // Approve swap txs
  for (let i = 0; i < transactions.length; i++) {
    const scheduledTransaction = transactions[i];
    multiple.addTransaction(scheduledTransaction, NO_CHILD_INDEX, 0);
    scheduledTransactions.push(scheduledTransaction);
  }

  // [1] scheduled trx
  const scheduledTransaction = createScheduledNeonEvmMultipleTransaction({
    chainId: chainId,
    neonEvmProgram: neonEvmProgram,
    neonTransaction: multiple.data,
    signerAddress: solanaUser.publicKey,
    tokenMintAddress: solanaUser.tokenMint,
    neonWallet: solanaUser.neonWallet,
    neonWalletNonce: nonce
  });

  logJson(scheduledTransactions.map(d => d.data))

  // [0] approve
  scheduledTransaction.instructions.unshift(approveInstruction);

  return {
    scheduledTransaction,
    transactions: scheduledTransactions
  };
}

export function swapTokensMultiple(params: SwapTokenCommonData): SwapTokensResponse {
  const { neonEvmProgram, solanaUser, nonce, chainId, transactionGas } = params;
  // const [claimTransaction, approveInstruction] = transferTokenToNeonTransaction(0, params);
  const pancakeTransaction = pancakeSwapTransaction(1, params);
  const transferSolanaTransaction = transferTokenToSolanaTransaction(2, params);

  const transactions: ScheduledTransaction[] = [
    // claimTransaction,
    pancakeTransaction,
    transferSolanaTransaction
  ];

  const multiple = new MultipleTransactions(nonce, transactionGas.maxFeePerGas, transactionGas.maxPriorityFeePerGas);
  // multiple.addTransaction(claimTransaction, 1, 0);
  // multiple.addTransaction(pancakeTransaction, 2, 1);
  // multiple.addTransaction(transferSolanaTransaction, NO_CHILD_INDEX, 1);
  multiple.addTransaction(pancakeTransaction, 1, 1);
  multiple.addTransaction(transferSolanaTransaction, NO_CHILD_INDEX, 1);

  // [1] scheduled
  const scheduledTransaction = createScheduledNeonEvmMultipleTransaction({
    chainId: chainId,
    neonEvmProgram: neonEvmProgram,
    neonTransaction: multiple.data,
    signerAddress: solanaUser.publicKey,
    tokenMintAddress: solanaUser.tokenMint,
    neonWallet: solanaUser.neonWallet,
    neonWalletNonce: nonce
  });
  //
  // // [0] approve
  // scheduledTransaction.instructions.unshift(approveInstruction);

  return { scheduledTransaction, transactions };
}

export async function waitTransactionTreeExecution(proxyApi: NeonProxyRpcApi, address: NeonAddress | SolanaAddress, nonce: number, duration: number, delayTimeout = 500): Promise<ScheduledTreeAccount> {
  const start = Date.now();
  let treeAccount: ScheduledTreeAccount;
  while (duration > Date.now() - start) {
    const { result } = await proxyApi.getScheduledTreeAccount(address, nonce);
    if (result) {
      treeAccount = result;
      if (['Success', 'Empty', 'Failed'].includes(result.activeStatus)) {
        return treeAccount;
      }
    } else {
      return treeAccount;
    }
    await delay(delayTimeout);
  }
  return treeAccount;
}
