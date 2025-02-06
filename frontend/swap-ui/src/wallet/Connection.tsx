import { createContext, FC, useContext, useEffect, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Commitment, PublicKey, SendOptions, Transaction } from '@solana/web3.js';
import {
  getGasToken,
  getProxyState, logJson,
  NeonProxyRpcApi,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import { JsonRpcProvider } from 'ethers';
import { NEON_CORE_API_RPC_URL } from '../environments';
import { Props } from '../models';
import { solanaTransactionLog } from '@neonevm/token-transfer-core';
import { simulateTransaction } from '../utils/solana.ts';

export interface ProxyConnectionContextData {
  chainId: number;
  tokenMint: PublicKey;
  neonEvmProgram: PublicKey;
  solanaUser: SolanaNeonAccount;
  proxyApi: NeonProxyRpcApi;
  provider: JsonRpcProvider;

  sendTransaction(transaction: Transaction, commitment?: Commitment, options?: SendOptions): Promise<string | undefined>;
}

export const ProxyConnectionContext = createContext<ProxyConnectionContextData>({} as ProxyConnectionContextData);
export const ProxyConnectionProvider: FC<Props> = ({ children }) => {
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [neonEvmProgram, setEvmProgramAddress] = useState<PublicKey>();
  const [proxyApi, setProxyApi] = useState<NeonProxyRpcApi>();
  const [tokenMint, setTokenMint] = useState<PublicKey>();
  const [chainId, setChainId] = useState<number>();

  const sendTransaction = async (transaction: Transaction, commitment: Commitment = 'confirmed', options?: SendOptions): Promise<string | undefined> => {
    if (signTransaction) {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = solanaUser.publicKey;
      const {value} = await simulateTransaction(connection, transaction, commitment);
      logJson(value.err);
      logJson(value.logs);
      const signedTransaction = await signTransaction(transaction);
      solanaTransactionLog(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize(), options);
      await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature }, commitment);
      console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);
      return signature;
    }
  };

  const solanaUser = useMemo<SolanaNeonAccount>(() => {
    if (connected && publicKey && neonEvmProgram && tokenMint && chainId) {
      return new SolanaNeonAccount(publicKey, neonEvmProgram, tokenMint, chainId);
    }
  }, [connected, publicKey, neonEvmProgram, tokenMint, chainId]);

  const provider = useMemo<JsonRpcProvider>(() => {
    return new JsonRpcProvider(`${NEON_CORE_API_RPC_URL}/sol`);
  }, []);

  useEffect(() => {
    (async () => {
      const { chainId: chainIdB } = await provider.getNetwork();
      const result = await getProxyState(`${NEON_CORE_API_RPC_URL}/sol`);
      setEvmProgramAddress(result.evmProgramAddress);
      setProxyApi(result.proxyApi);
      setChainId(Number(chainIdB));
      const token = getGasToken(result.tokensList, Number(chainIdB));
      setTokenMint(token.tokenMintAddress);
    })();
  }, [provider]);

  return (
    <ProxyConnectionContext.Provider value={{
      chainId: chainId!,
      tokenMint: tokenMint!,
      neonEvmProgram: neonEvmProgram!,
      solanaUser: solanaUser!,
      proxyApi: proxyApi!,
      provider: provider!,
      sendTransaction
    }}>
      {children}
    </ProxyConnectionContext.Provider>
  );
};

export const useProxyConnection = () => useContext(ProxyConnectionContext);
