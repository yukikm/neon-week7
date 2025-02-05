import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { createApproveInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { authAccountAddress, SPLToken, toFullAmount } from '@neonevm/token-transfer-core';
import { PublicKey, Transaction } from '@solana/web3.js';
import { NeonAddress } from '@neonevm/solana-sign';
import React, { useEffect, useMemo, useState } from 'react';
import { TokenField } from './components/TokenField/TokenField.tsx';
import { swap, tokensList } from '../data/tokens.ts';
import { CTokenBalance } from '../models';
import { approveTokens, pancakeTokensSwap, swapTokens, transferTokenToNeonEvm } from '../api/swap';
import { useProxyConnection } from '../wallet/Connection';
import './SwapForm.css';

interface FormData {
  from: { token: string, amount: string },
  to: { token: string, amount: string },
}

export const SwapForm: React.FC = () => {
  const { connected, publicKey } = useWallet();
  const [tokenBalanceList, setTokenBalanceList] = useState<CTokenBalance[]>([]);
  const { connection } = useConnection();
  const { solanaUser, proxyApi, chainId, neonEvmProgram, sendTransaction } = useProxyConnection();
  const [one, two] = tokensList;
  const [formData, setFormData] = useState<FormData>({
    from: { token: one.symbol!, amount: '' },
    to: { token: two.symbol!, amount: '' }
  });
  const [loading, setLoading] = useState<boolean>(false);

  const __handleSubmit = async () => {
    try {
      setLoading(true);
      const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
      const amountFrom = Number(formData.from.amount);
      const amountTo = Number(formData.to.amount);
      const tokenFrom = tokensList.find(t => t.symbol === formData.from.token)!;
      const tokenTo = tokensList.find(t => t.symbol === formData.to.token)!;
      const key: string = `${formData.from.token}/${formData.to.token}`.toLowerCase();
      const pairAddress: NeonAddress = swap.pairs[key];
      const pancakeRouter: NeonAddress = swap.router;

      // Approve
      // const transaction = new Transaction();
      // const fromATA = getAssociatedTokenAddressSync(new PublicKey(tokenFrom.address_spl), solanaUser.publicKey);
      // const tokenAmount = toFullAmount(amountFrom, tokenFrom.decimals);
      // const [delegatePDA] = authAccountAddress(solanaUser.neonWallet, neonEvmProgram, tokenFrom as SPLToken);
      // const approveInstruction = createApproveInstruction(fromATA, delegatePDA, solanaUser.publicKey, tokenAmount);
      // transaction.instructions.push(approveInstruction);
      // await sendTransaction(transaction);

      console.log(key, pairAddress);
      // const maxFeePerGas = 0x989680;
      const { scheduledTransaction, transactions } = await swapTokens({
        solanaUser,
        nonce,
        amountFrom,
        amountTo,
        tokenFrom,
        tokenTo,
        chainId,
        neonEvmProgram,
        pairAddress,
        pancakeRouter,
        proxyApi
      });
      console.log(scheduledTransaction, transactions);

      const signature = await sendTransaction(scheduledTransaction);
      const response = await proxyApi.waitTransactionByHash(signature, 5e3);
      console.log(response);

      for (const transaction of transactions) {
        const { result } = await proxyApi.sendRawScheduledTransaction(`0x${transaction.serialize()}`);
        console.log(result);
      }

      const transactionExecution = await proxyApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 3e4);
      console.log(transactionExecution);
      setLoading(false);
    } catch (e: unknown) {
      console.log(e.message);
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const tokenFrom = tokensList.find(t => t.symbol === formData.from.token)!;
      const tokenTo = tokensList.find(t => t.symbol === formData.to.token)!;
      const amountFrom = Number(formData.from.amount);
      const tokenAmount = toFullAmount(amountFrom, tokenFrom.decimals);
      const fromATA = getAssociatedTokenAddressSync(new PublicKey(tokenFrom.address_spl), solanaUser.publicKey);
      const pair = `${tokenFrom.symbol}/${tokenTo.symbol}`.toLowerCase();
      const pancakePair = swap.pairs[pair];
      const pancakeRouter: NeonAddress = swap.router;
      console.log(pair, pancakePair);

      const run = true;

      if (run) {
        // Approve for claimTo method
        const transaction = new Transaction();
        const [delegatePDA] = authAccountAddress(solanaUser.neonWallet, neonEvmProgram, tokenFrom as SPLToken);
        const approveInstruction = createApproveInstruction(fromATA, delegatePDA, solanaUser.publicKey, tokenAmount);
        transaction.instructions.push(approveInstruction);
        await sendTransaction(transaction);
      }

      if (run) {
        const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));

        const scheduledTransaction = await transferTokenToNeonEvm({
          proxyApi,
          solanaUser,
          nonce,
          amount: amountFrom,
          token: tokenFrom,
          chainId,
          neonEvmProgram
        });

        const signature = await sendTransaction(scheduledTransaction);

        const response = await proxyApi.waitTransactionByHash(signature, 5e3);
        console.log(response);

        const transactionExecution = await proxyApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 6e4);
        console.log(transactionExecution);
      }

      // {
      //   // Approve for pancaceswap router method
      //   const transaction = new Transaction();
      //   const fromATA = getAssociatedTokenAddressSync(new PublicKey(tokenFrom.address_spl), solanaUser.publicKey);
      //   const [delegatePDA] = authAccountAddress(pancakePair, neonEvmProgram, tokenFrom as SPLToken);
      //   console.log(delegatePDA);
      //   const approveInstruction = createApproveInstruction(fromATA, delegatePDA, solanaUser.publicKey, tokenAmount);
      //   transaction.instructions.push(approveInstruction);
      //   await sendTransaction(transaction);
      // }

      if (run) {
        const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));

        const { scheduledTransaction, transactions } = await approveTokens({
          proxyApi,
          solanaUser,
          nonce,
          amount: amountFrom,
          tokenFrom,
          tokenTo,
          chainId,
          neonEvmProgram,
          pancakeRouter,
          pancakePair
        });

        await sendTransaction(scheduledTransaction);

        for (const transaction of transactions) {
          const { result } = await proxyApi.sendRawScheduledTransaction(`0x${transaction.serialize()}`);
          console.log(result);
        }

        const transactionExecution = await proxyApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 6e4);
        console.log(transactionExecution);
      }

      {
        const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));

        const scheduledTransaction = await pancakeTokensSwap({
          proxyApi,
          solanaUser,
          nonce,
          amount: amountFrom,
          tokenFrom,
          tokenTo,
          chainId,
          neonEvmProgram,
          pancakeRouter
        });

        const signature = await sendTransaction(scheduledTransaction);

        const response = await proxyApi.waitTransactionByHash(signature, 5e3);
        console.log(response);

        const transactionExecution = await proxyApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 6e4);
        console.log(transactionExecution);
      }

      setLoading(false);
    } catch (e: unknown) {
      console.log(e.message);
      setLoading(false);
    }
  };

  const formValidation = useMemo((): boolean => {
    const { from, to } = formData;
    return from.amount?.length === 0 || to.amount?.length === 0;
  }, [formData]);

  const buttonText = useMemo((): string => {
    const { from, to } = formData;
    if (!connected) {
      return `Connect wallet`;
    }
    if (from.amount?.length === 0 || to.amount?.length === 0) {
      return `Enter an amount`;
    }
    if (loading) {
      return `Whait...`;
    }
    return `Swap`;
  }, [formData, connected, loading]);

  const handleSwitch = () => {
    const { from, to } = formData;
    setFormData({ from: to, to: from });
    console.log(JSON.stringify(formData));
  };

  const handleTokenData = (type: 'from' | 'to', value: {
    token: CTokenBalance;
    amount: string;
  }): void => {
    setFormData({ ...formData, [type]: value });
  };

  useEffect(() => {
    const getBalance = async (): Promise<void> => {
      const tokens: CTokenBalance[] = [];
      for (const token of tokensList) {
        const cTokenBalance: CTokenBalance = { token, balance: undefined };
        if (publicKey) {
          const tokenMint = new PublicKey(token.address_spl);
          const tokenAddress = getAssociatedTokenAddressSync(tokenMint, publicKey);
          const { value: balance } = await connection.getTokenAccountBalance(tokenAddress);
          cTokenBalance['balance'] = balance;
        }
        tokens.push(cTokenBalance);
      }
      setTokenBalanceList(tokens);
    };

    getBalance().catch(console.log);
  }, [publicKey]);

  return (
    <div>
      <div className="form-group">
        <div className="form-label !mb-[10px]">
          <label>Contract version</label>
        </div>
        <div className="button-group">
          <button type="button" className="button active">v1</button>
          <button type="button" className="button" disabled>v1~v2</button>
          <button type="button" className="button" disabled>v2</button>
        </div>
      </div>
      <div className="form-group">
        <div className="form-field">
          <TokenField data={formData.from} tokensList={tokenBalanceList}
                      excludedToken={formData.to.token}
                      setTokenData={handleTokenData} label="From" type="from"></TokenField>
        </div>
        <div className="form-divider">
          <button className="switch-tokens" type={'button'} onClick={handleSwitch}>
            <img src="/assets/icons/switch.svg" alt="Switch" />
          </button>
        </div>
        <div className="form-field">
          <TokenField data={formData.to} tokensList={tokenBalanceList}
                      excludedToken={formData.from.token}
                      setTokenData={handleTokenData} label="To" type="to"></TokenField>
        </div>
      </div>
      <div className="form-group">
        <div className="form-field">
          <button className="form-button" onClick={handleSubmit}
                  disabled={formValidation || loading}>
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SwapForm;
