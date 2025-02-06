import React from 'react';
import { SPLToken } from '@neonevm/token-transfer-core';
import { Connection, PublicKey, TokenAmount, Transaction } from '@solana/web3.js';
import {
  NeonAddress,
  NeonProxyRpcApi,
  ScheduledTransaction, ScheduledTreeAccount,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import { JsonRpcProvider } from 'ethers';
import { TransactionStatus } from '@neonevm/solana-sign/dist/types/models/api';

export type Props = {
  readonly children: React.ReactNode;
};

export interface CSPLToken extends SPLToken {
  chainId?: number;
  logoURI?: string;
}

export interface CTokenBalance {
  token: CSPLToken;
  balance?: TokenAmount;
  neonBalance?: bigint;
}

export interface TransactionGas {
  gasLimit: number[];
  maxFeePerGas: number;
  maxPriorityFeePerGas: number;
}

export interface SwapTokenMultipleData {
  proxyApi: NeonProxyRpcApi;
  solanaUser: SolanaNeonAccount;
  neonEvmProgram: PublicKey;
  tokenFrom: CSPLToken;
  tokenTo: CSPLToken;
  pairAddress: NeonAddress;
  pancakeRouter: NeonAddress;
  chainId: number;
  amountFrom: number;
  amountTo: number;
  nonce: number;
}

export interface SwapTokenCommonData {
  transactionGas: TransactionGas;
  proxyApi: NeonProxyRpcApi;
  provider: JsonRpcProvider;
  connection: Connection;
  solanaUser: SolanaNeonAccount;
  neonEvmProgram: PublicKey;
  tokenFrom: CSPLToken;
  tokenTo: CSPLToken;
  pancakeRouter: NeonAddress;
  pancakePair: NeonAddress;
  chainId: number;
  amountFrom: number;
  amountTo: number;
  nonce: number;
}

export interface SwapTokensResponse {
  scheduledTransaction: Transaction,
  transactions: ScheduledTransaction[]
}

export interface FormState {
  id: number;
  title: string;
  status: TransactionStatus;
  method: (nonce: number, transactionGas: TransactionGas) => Promise<SwapTokensResponse>;
  gas?: TransactionGas;
  data?: ScheduledTreeAccount;
}

export interface TransferTokenData {
  proxyApi: NeonProxyRpcApi;
  solanaUser: SolanaNeonAccount;
  neonEvmProgram: PublicKey;
  token: CSPLToken;
  chainId: number;
  amount: number;
  nonce: number;
}

export interface TransferTokenToSolanaData {
  proxyApi: NeonProxyRpcApi;
  provider: JsonRpcProvider;
  solanaUser: SolanaNeonAccount;
  neonEvmProgram: PublicKey;
  token: CSPLToken;
  chainId: number;
  nonce: number;
}


export interface SwapTokensData {
  proxyApi: NeonProxyRpcApi;
  solanaUser: SolanaNeonAccount;
  neonEvmProgram: PublicKey;
  tokenFrom: CSPLToken;
  tokenTo: CSPLToken;
  pancakeRouter: NeonAddress;
  pancakePair?: NeonAddress;
  chainId: number;
  amount: number;
  nonce: number;
}
