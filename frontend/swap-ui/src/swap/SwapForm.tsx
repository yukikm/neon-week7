import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { createApproveInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { authAccountAddress, SPLToken, toFullAmount } from '@neonevm/token-transfer-core';
import { PublicKey, Transaction } from '@solana/web3.js';
import { delay, logJson, NeonAddress } from '@neonevm/solana-sign';
import React, { useEffect, useMemo, useState } from 'react';
import { TokenField } from './components/TokenField/TokenField.tsx';
import { swap, tokensList } from '../data/tokens.ts';
import { CTokenBalance, FormState, SwapTokensResponse, TransactionGas } from '../models';
import {
  approveTokens,
  approveTokensMultiple,
  pancakeTokensSwap,
  swapTokensMultiple,
  transferTokenToNeonEvm
} from '../api/swap';
import { useProxyConnection } from '../wallet/Connection';
import './SwapForm.css';
import SwapState from './components/SwapState/SwapState.tsx';

interface FormData {
  from: { token: string, amount: string },
  to: { token: string, amount: string },
}

const DURATION = 12e4;
const DELAY = 5e2;

export const SwapForm: React.FC = () => {
  const { connected, publicKey } = useWallet();
  const [tokenBalanceList, setTokenBalanceList] = useState<CTokenBalance[]>([]);
  const { connection } = useConnection();
  const {
    solanaUser,
    proxyApi,
    chainId,
    neonEvmProgram,
    sendTransaction,
    provider
  } = useProxyConnection();
  const [one, two] = tokensList;
  const [formData, setFormData] = useState<FormData>({
    from: { token: one.symbol!, amount: '0.01' },
    to: { token: two.symbol!, amount: '0.001' }
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [transactionStates, setTransactionStates] = useState<FormState[]>([]);

  const changeTransactionStates = (state: FormState): void => {
    const states = transactionStates.map(st => {
      if (st.id === state.id) {
        return state;
      }
      return st;
    });
    setTransactionStates(states);
  };

  // const handleSubmit = async () => {
  //   const { result } = await proxyApi.getPendingTransactions(solanaUser.publicKey);
  //   console.log(result);
  // };

  const approveSwap = (nonce: number, transactionGas: TransactionGas): SwapTokensResponse => {
    const tokenFrom = tokensList.find(t => t.symbol === formData.from.token)!;
    const tokenTo = tokensList.find(t => t.symbol === formData.to.token)!;
    const amountFrom = Number(formData.from.amount);
    const amountTo = Number(formData.to.amount);
    const pair = `${tokenFrom.symbol}/${tokenTo.symbol}`.toLowerCase();
    const pancakePair = swap.pairs[pair];
    const pancakeRouter: NeonAddress = swap.router;

    return approveTokensMultiple({
      transactionGas,
      nonce,
      proxyApi,
      provider,
      connection,
      solanaUser,
      neonEvmProgram,
      tokenFrom,
      tokenTo,
      amountFrom,
      amountTo,
      pancakePair,
      pancakeRouter,
      chainId
    });
  };

  const tokensSwap = (nonce: number, transactionGas: TransactionGas): SwapTokensResponse => {
    const tokenFrom = tokensList.find(t => t.symbol === formData.from.token)!;
    const tokenTo = tokensList.find(t => t.symbol === formData.to.token)!;
    const amountFrom = Number(formData.from.amount);
    const amountTo = Number(formData.to.amount);
    const pair = `${tokenFrom.symbol}/${tokenTo.symbol}`.toLowerCase();
    const pancakePair = swap.pairs[pair];
    const pancakeRouter: NeonAddress = swap.router;

    return swapTokensMultiple({
      transactionGas,
      nonce,
      proxyApi,
      provider,
      connection,
      solanaUser,
      neonEvmProgram,
      tokenFrom,
      tokenTo,
      amountFrom,
      amountTo,
      pancakePair,
      pancakeRouter,
      chainId
    });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const approveState: FormState = {
        id: 0,
        title: `Approve`,
        status: `NoStarted`,
        method: approveSwap,
        gas: {
          gasLimit: [5e4, 5e4, 5e4, 5e4],
          maxFeePerGas: 1850000000,
          maxPriorityFeePerGas: 1250000000
        }
      };
      const swapState: FormState = {
        id: 1,
        title: `Swap tokens`,
        status: `NoStarted`,
        method: tokensSwap,
        gas: {
          gasLimit: [1e5],
          maxFeePerGas: 2500000000,
          maxPriorityFeePerGas: 1500000000
        }
      };
      const states = [approveState, swapState];
      await setTransactionStates(states);
      for (const state of states) {
        const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
        const { scheduledTransaction, transactions } = state.method(nonce, state.gas);
        await sendTransaction(scheduledTransaction);

        const results = [];
        for (const transaction of transactions) {
          results.push(proxyApi.sendRawScheduledTransaction(`0x${transaction.serialize()}`));
        }
        const resultsHash = await Promise.all(results);
        logJson(resultsHash);

        const start = Date.now();
        const duration = 12e4;
        const delayTimeout = 500;
        while (duration > Date.now() - start) {
          const { result } = await proxyApi.getScheduledTreeAccount(solanaUser.neonWallet, nonce);
          if (result) {
            state.data = result;
            state.status = result.activeStatus;
            changeTransactionStates(state);
            if (['Success', 'Empty', 'Failed'].includes(result.activeStatus)) {
              break;
            }
          } else {
            break;
          }
          await delay(delayTimeout);
        }
      }

      setLoading(false);
    } catch (e: unknown) {
      console.log(e.message);
      setLoading(false);
    }
  };

  const __handleSubmit = async () => {
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
      console.log(tokenAmount, amountFrom);

      const run = true;

      if (!run) {
        // Approve for claimTo method
        const transaction = new Transaction();
        const [delegatePDA] = authAccountAddress(solanaUser.neonWallet, neonEvmProgram, tokenFrom as SPLToken);
        const approveInstruction = createApproveInstruction(fromATA, delegatePDA, solanaUser.publicKey, tokenAmount);
        transaction.instructions.push(approveInstruction);
        await sendTransaction(transaction);
      }

      if (!run) {
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

        await sendTransaction(scheduledTransaction);

        const transactionExecution = await proxyApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, DURATION, DELAY);
        console.log(transactionExecution);
      }

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

        const results = [];
        for (const transaction of transactions) {
          results.push(proxyApi.sendRawScheduledTransaction(`0x${transaction.serialize()}`));
        }
        const resultsHash = await Promise.all(results);
        console.log(resultsHash);

        const transactionExecution = await proxyApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, DURATION, DELAY);
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

        await sendTransaction(scheduledTransaction);

        // const response = await proxyApi.waitTransactionByHash(signature, 5e3);
        // console.log(response);

        const transactionExecution = await proxyApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, DURATION, DELAY);
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
          try {
            const tokenMint = new PublicKey(token.address_spl);
            const tokenAddress = getAssociatedTokenAddressSync(tokenMint, publicKey);
            const { value: balance } = await connection.getTokenAccountBalance(tokenAddress);
            cTokenBalance['balance'] = balance;
          } catch (e) {
            console.log(e);
          }
        }
        tokens.push(cTokenBalance);
      }
      setTokenBalanceList(tokens);
    };

    getBalance().catch(console.log);
  }, [publicKey, loading]);

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
      {transactionStates.length > 0 && <div className="form-group">
        <div className="form-field">
          {transactionStates.map((state, key) => {
            return <SwapState formState={state} loading={loading} key={key}></SwapState>;
          })}
        </div>
      </div>}
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
