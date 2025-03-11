import { PublicKey } from '@solana/web3.js';
import { CSPLToken, SolanaEnvironment, TokensListResponse, TransactionResponse } from '../models';
import { AIRDROP_URL } from '../environments';
import { get, post } from '../utils/rest.ts';


const apiUrl = `${AIRDROP_URL}/api/v1`;

export async function getTokensList(env: string): Promise<TokensListResponse> {
  return get<TokensListResponse>(`${apiUrl}/tokens/${env}`);
}

export async function tokenAirdropTransaction(wallet: PublicKey, token: CSPLToken, network: SolanaEnvironment, amount: number): Promise<TransactionResponse> {
  return await post(`${apiUrl}/airdrop`, {
    wallet: wallet.toBase58(),
    token: token.address_spl,
    amount: amount,
    network: network
  });
}
