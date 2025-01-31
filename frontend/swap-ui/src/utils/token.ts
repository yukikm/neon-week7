import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';
import { CSPLToken } from '../models';
import {
  createScheduledNeonEvmTransaction,
  NeonProxyRpcApi,
  ScheduledTransaction,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import { mintNeonTransactionData } from '@neonevm/token-transfer-ethers';

export async function sendTokenToNeonEvm(connection: Connection, neonProxyRpcApi: NeonProxyRpcApi, solanaUser: SolanaNeonAccount, neonEvmProgram: PublicKey, token: CSPLToken, amount: number, chainId: number): Promise<any> {

  const associatedToken = getAssociatedTokenAddressSync(new PublicKey(token.address_spl), solanaUser.publicKey);
  const data = mintNeonTransactionData(associatedToken, token, amount);

  const nonce = Number(await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet));
  const maxFeePerGas = 0x77359400; // 0x3B9ACA00;
  const scheduledTransaction = new ScheduledTransaction({
    nonce: nonce,
    payer: solanaUser.neonWallet,
    index: 0,
    target: token.address,
    callData: data,
    maxFeePerGas: maxFeePerGas,
    chainId: chainId
  });

  const createScheduledTransaction = await createScheduledNeonEvmTransaction({
    chainId: chainId,
    signerAddress: solanaUser.publicKey,
    tokenMintAddress: solanaUser.tokenMint,
    neonEvmProgram: neonEvmProgram,
    neonWallet: solanaUser.neonWallet,
    neonWalletNonce: nonce,
    neonTransaction: scheduledTransaction.serialize()
  });
}
