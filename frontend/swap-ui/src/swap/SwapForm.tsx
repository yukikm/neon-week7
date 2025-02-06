import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { delay, logJson, NeonAddress } from '@neonevm/solana-sign';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TokenField } from './components/TokenField/TokenField.tsx';
import { swap, tokensList } from '../data/tokens.ts';
import { CTokenBalance, FormState, SwapTokensResponse, TransactionGas } from '../models';
import { approveTokensMultiple, swapTokensMultiple } from '../api/swap';
import { useProxyConnection } from '../wallet/Connection';
import './SwapForm.css';
import SwapState from './components/SwapState/SwapState.tsx';
import { ScheduledTransactionStatus } from '@neonevm/solana-sign/dist/types/models/api';
import { getTokenExchangeRate } from '../utils/token.ts';

interface FormData {
  from: { token: string, amount: string },
  to: { token: string, amount: string },
}

const DURATION = 12e4;
const DELAY = 1e3;

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
  const transactionsRef = useRef<FormState[]>([]);

  const changeTransactionStates = (state: FormState): void => {
    setTransactionStates(currentState => currentState.map(st => {
      if (st.id === state.id) {
        return state;
      }
      return st;
    }));
  };

  const addTransactionStates = (states: FormState[]): void => {
    setTransactionStates(states);
  };

  const resetTransactionStates = (): void => {
    setTransactionStates(_ => []);
  };

  const approveSwap = async (nonce: number, transactionGas: TransactionGas): Promise<SwapTokensResponse> => {
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

  const tokensSwap = async (nonce: number, transactionGas: TransactionGas): Promise<SwapTokensResponse> => {
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

  const cancelTransaction = async (status: ScheduledTransactionStatus) => {
    const { result } = await proxyApi.getPendingTransactions(solanaUser.publicKey);
    console.log(result);
  };

  const executeTransactionState = async (state: FormState): Promise<void> => {
    try {
      setLoading(true);
      const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
      const { maxPriorityFeePerGas, maxFeePerGas } = await proxyApi.getMaxFeePerGas();
      const { scheduledTransaction, transactions } = await state.method(nonce, {
        maxPriorityFeePerGas,
        maxFeePerGas,
        gasLimit: [12e4, 12e4, 12e4]
      });
      changeTransactionStates(state);

      await sendTransaction(scheduledTransaction);
      console.log(maxFeePerGas, maxPriorityFeePerGas);

      const results = [];
      for (const transaction of transactions) {
        results.push(proxyApi.sendRawScheduledTransaction(`0x${transaction.serialize()}`));
      }
      const resultsHash = await Promise.all(results);
      logJson(resultsHash);

      const start = Date.now();
      while (DURATION > Date.now() - start) {
        const { result } = await proxyApi.getScheduledTreeAccount(solanaUser.neonWallet, nonce);
        if (result) {
          state.data = result;
          state.status = result.activeStatus;
          changeTransactionStates(state);
          if (['Success', 'Empty', 'Failed', 'Skipped'].includes(result.activeStatus)) {
            break;
          }
        } else {
          break;
        }
        await delay(DELAY);
      }
      setLoading(false);
    } catch (e) {
      console.log(e.message);
      setLoading(false);
    }
  };

  const executeTransactionsStates = async (transactionStates: FormState[]): Promise<void> => {
    for (const state of transactionStates) {
      await executeTransactionState(state);
    }
  };

  const handleSubmit = async () => {
    try {
      const approveState: FormState = {
        id: 0,
        title: `Approve`,
        status: `NoStarted`,
        method: approveSwap,
        data: undefined
      };
      const swapState: FormState = {
        id: 1,
        title: `Swap tokens`,
        status: `NoStarted`,
        method: tokensSwap,
        data: undefined
      };
      transactionsRef.current = [approveState, swapState];
      addTransactionStates(transactionsRef.current);
      await executeTransactionsStates(transactionsRef.current);
    } catch (e: unknown) {
      console.log(e.message);
      if (transactionsRef.current.some(i => !i.data)) {
        transactionsRef.current = [];
        addTransactionStates(transactionsRef.current);
      }
      setLoading(false);
    }
  };

  const formValidation = useMemo((): boolean => {
    const { from, to } = formData;
    return !from.amount || !to.amount;
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
    resetTransactionStates();
    console.log(JSON.stringify(formData));
  };

  const handleTokenData = async (type: 'from' | 'to', value: {
    token: CTokenBalance;
    amount: string;
  }): void => {
    setFormData({ ...formData, [type]: value });
    // if (type === 'from') {
    //   const tokenFrom = tokensList.find(t => t.symbol === formData.from.token)!;
    //   const tokenTo = tokensList.find(t => t.symbol === formData.to.token)!;
    //   const data = await getTokenExchangeRate(provider, swap.router, tokenFrom, tokenTo, formData.from?.amount);
    //   const to = formData.to;
    //   to.amount = (Number(data[1]) / tokenTo.decimals).toString();
    //   setFormData({ ...formData, to });
    // }
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
            return <SwapState key={key} formState={state} loading={loading}
                              executeState={executeTransactionState}
                              transactionCancel={cancelTransaction}></SwapState>;
          })}
        </div>
      </div>}
      <div className="form-group">
        <div className="form-field">
          <button className="form-button" onClick={handleSubmit}
                  disabled={!publicKey || formValidation || loading}>
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SwapForm;
