import React from 'react';
import { SPLToken } from '@neonevm/token-transfer-core';
import { TokenAmount } from '@solana/web3.js';

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
