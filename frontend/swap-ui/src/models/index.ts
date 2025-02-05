import React from 'react';
import { SPLToken } from '@neonevm/token-transfer-core';
import { PublicKey, TokenAmount, Transaction } from '@solana/web3.js';
import {
  NeonAddress,
  NeonProxyRpcApi,
  ScheduledTransaction,
  SolanaNeonAccount
} from '@neonevm/solana-sign';

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
  neonBalance?: any;
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

export interface SwapTokensResponse {
  scheduledTransaction: Transaction,
  transactions: ScheduledTransaction[]
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
