import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import {
  getGasToken,
  getProxyState,
  NeonProxyRpcApi,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import { JsonRpcProvider } from 'ethers';
import { NEON_CORE_API_RPC_URL } from '../environments';


export interface ProxyConnectionContextData {
  chainId: number;
  tokenMint: PublicKey;
  neonEvmProgram: PublicKey;
  solanaUser: SolanaNeonAccount;
  proxyApi: NeonProxyRpcApi;
  provider: JsonRpcProvider;
}

export const ProxyConnectionContext = createContext<ProxyConnectionContextData>({} as ProxyConnectionContextData);
export const ProxyConnectionProvider = ({ children }) => {
  const { connected, publicKey, signTransaction } = useWallet();
  const [neonEvmProgram, setEvmProgramAddress] = useState<PublicKey>();
  const [proxyApi, setProxyApi] = useState<NeonProxyRpcApi>();
  const [tokenMint, setTokenMint] = useState<PublicKey>();
  const [chainId, setChainId] = useState<number>();

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
      provider: provider!
    }}>
      {children}
    </ProxyConnectionContext.Provider>
  );
};

export const useProxyConnection = () => useContext(ProxyConnectionContext);
