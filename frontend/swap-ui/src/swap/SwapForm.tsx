import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { delay, logJson, NeonAddress, ScheduledTransactionStatus } from '@neonevm/solana-sign';
import { SPLToken } from '@neonevm/token-transfer-core';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Big } from 'big.js';
import { TokenField } from './components/TokenField/TokenField';
import SwapState from './components/SwapState/SwapState';
import { useProxyConnection } from '../wallet/Connection';
import {
  CSPLToken,
  CTokenBalance,
  FormState,
  PancakePair,
  SwapTokenCommonData,
  SwapTokensResponse,
  TransactionGas
} from '../models';
import { estimateSwapAmount } from '../api/swap';
import { tokens } from '../data/tokens';
import { PROXY_ENV } from '../environments';
import './SwapForm.css';

const { swap } = tokens(PROXY_ENV);

interface FormData {
  from: { token: string, amount: string },
  to: { token: string, amount: string },
}

const DURATION = 3e5;
const DELAY = 1e3;
const MAX_AMOUNT = PROXY_ENV === 'devnet' ? 10 : 20;

interface Props {
  tokensList: SPLToken[];

  swapMethod(params: SwapTokenCommonData): Promise<SwapTokensResponse>;
}

export const SwapForm: React.FC = (props: Props) => {
  const { tokensList, swapMethod } = props;
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
    from: { token: one.symbol!, amount: '' },
    to: { token: two.symbol!, amount: '' }
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [transactionStates, setTransactionStates] = useState<FormState[]>([]);
  const transactionsRef = useRef<FormState[]>([]);
  const [error, setError] = useState<string>(``);
  const [fieldLoading, setFieldLoading] = useState<boolean>(false);

  const formValidation = useMemo((): boolean => {
    const { from, to } = formData;
    const tokenFrom = tokenBalanceList.find(t => t.token.symbol === formData.from.token)!;
    const a = Number(from.amount);
    const b = Number(to.amount);
    const c = [NaN, 0];
    return !from.amount || !to.amount || c.includes(a) || c.includes(b) || !tokenFrom?.balance?.amount;
  }, [formData, tokenBalanceList]);

  const tokenFromTo = useMemo<[CSPLToken, CSPLToken]>(() => {
    const tokenFrom = tokensList.find(t => t.symbol === formData.from.token)!;
    const tokenTo = tokensList.find(t => t.symbol === formData.to.token)!;
    return [tokenFrom, tokenTo];
  }, [formData.from.token, formData.to.token, tokensList]);

  const pancakePair = useMemo<PancakePair>(() => {
    const [tokenFrom, tokenTo] = tokenFromTo;
    const pair = `${tokenFrom.symbol}/${tokenTo.symbol}`.toLowerCase();
    return swap.pairs[pair];
  }, [tokenFromTo]);

  const buttonText = useMemo((): string => {
    const { from, to } = formData;
    if (!connected) {
      return `Connect wallet`;
    }
    if (!pancakePair?.pair) {
      return `Unsupported pair`;
    }
    if (from.amount?.length === 0 || to.amount?.length === 0) {
      return `Enter an amount`;
    }
    if (loading) {
      return `Wait...`;
    }
    return `Swap`;
  }, [formData, connected, loading, pancakePair]);

  const formDisabled = useMemo<boolean>(() => {
    return !publicKey || !pancakePair || formValidation || loading || fieldLoading;
  }, [formValidation, loading, pancakePair, publicKey, fieldLoading]);

  const changeTransactionStates = (state: FormState): void => {
    setTransactionStates(prev => prev.map(st => {
      if (st.id === state.id) {
        return state;
      }
      return st;
    }));
  };

  const addTransactionStates = (states: FormState[]): void => {
    setTransactionStates(_ => states);
  };

  const resetTransactionStates = (): void => {
    setTransactionStates(_ => []);
  };

  const approveAndSwap = async (nonce: number, transactionGas: TransactionGas): Promise<SwapTokensResponse> => {
    const [tokenFrom, tokenTo] = tokenFromTo;
    const amountFrom = Number(formData.from.amount);
    const amountTo = Number(formData.to.amount);
    const pancakeRouter: NeonAddress = swap.router;

    return swapMethod({
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

  const cancelTransaction = async (_: ScheduledTransactionStatus) => {
    const { result } = await proxyApi.getPendingTransactions(solanaUser.publicKey);
    console.log(result);
  };

  const executeTransactionState = async (state: FormState): Promise<void> => {
    try {
      setLoading(true);
      setError('');
      const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
      const { maxPriorityFeePerGas: a, maxFeePerGas: b } = await proxyApi.getMaxFeePerGas();
      const { scheduledTransaction, transactions } = await state.method(nonce, {
        maxPriorityFeePerGas: a,
        maxFeePerGas: b,
        gasLimit: [1e7, 1e7, 1e7] // 10_000_000
      });
      changeTransactionStates(state);
      const signature = await sendTransaction(scheduledTransaction, 'confirmed', { skipPreflight: true });
      if (signature) {
        state.signature = signature;
        changeTransactionStates(state);
      }

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
          state.isCompleted = result.transactions.every(i => i.status === 'Success');
          changeTransactionStates(state);
          if (['Success', 'Empty', 'Failed', 'Skipped'].includes(result.activeStatus)) {
            break;
          }
        } else {
          break;
        }
        await delay(DELAY);
      }
    } catch (e) {
      console.log(e.message);
      setError(e.message);
      setLoading(false);
    }
  };

  const executeTransactionsStates = async (transactionStates: FormState[]): Promise<void> => {
    for (const state of transactionStates) {
      console.log(`Run transaction ${state.title}`);
      await executeTransactionState(state);
      await delay(1e3);
    }
  };

  const handleSubmit = async () => {
    try {
      const approveSwapAndWithdraw: FormState = {
        id: 0,
        title: `Approve and Swap tokens`,
        status: `NotStarted`,
        signature: ``,
        isCompleted: false,
        method: approveAndSwap,
        data: undefined
      };
      transactionsRef.current = [approveSwapAndWithdraw];
      addTransactionStates(transactionsRef.current);
      await executeTransactionsStates(transactionsRef.current);
      setLoading(false);
    } catch (e: unknown) {
      console.log(e.message);
      if (transactionsRef.current.some(i => !i.data)) {
        transactionsRef.current = [];
        addTransactionStates(transactionsRef.current);
      }
      setLoading(false);
    }
  };

  const handleSwitch = () => {
    const { from, to } = formData;
    // note: potential bug
    if (Number(to.amount) > MAX_AMOUNT) {
      to.amount = MAX_AMOUNT.toString();
    }
    setFormData({ from: to, to: from });
    setError('');
    resetTransactionStates();
  };

  const handleTokenData = (type: 'from' | 'to', value: {
    token: string;
    amount: string;
  }): void => {
    setFormData(prevData => {
      if (prevData[type].token !== value.token) {
        setError('');
        resetTransactionStates();
      }
      return ({ ...prevData, [type]: value });
    });
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
            console.log(e?.message);
          }
        }
        tokens.push(cTokenBalance);
      }
      setTokenBalanceList(() => tokens);
    };

    getBalance().catch(console.log);
  }, [publicKey, loading]);

  useEffect(() => {
    if (!connected) {
      resetTransactionStates();
      setFormData(prevState => {
        prevState.from.amount = '';
        prevState.to.amount = '';
        return prevState;
      });
    }
  }, [connected]);

  useEffect(() => {
    const amountFrom = formData.from.amount;
    if (pancakePair && amountFrom && Number(amountFrom) > 0) {
      setFieldLoading(true);
      estimateSwapAmount(provider, tokenFromTo, amountFrom, swap.router, pancakePair).then(balance => {
        const [, tokenTo] = tokenFromTo;
        const amount = new Big(balance.toString()).div(new Big(10).pow(tokenTo.decimals)).toString();
        handleTokenData('to', { token: formData.to.token, amount });
      }).then(() => delay(300)).then(() => {
        setFieldLoading(false);
      });
    } else {
      handleTokenData('to', { token: formData.to.token, amount: '' });
    }
  }, [formData.from.amount, tokenFromTo, provider, pancakePair]);

  return (
    <>
      <div className="form-group">
        <div className="form-field">
          <TokenField data={formData.from} tokensList={tokenBalanceList}
                      excludedToken={formData.to.token}
                      setTokenData={handleTokenData}
                      maxAmount={MAX_AMOUNT}
                      label="From" type="from"></TokenField>
        </div>
        <div className="form-divider">
          <button className="switch-tokens" type={'button'} onClick={handleSwitch}
                  disabled={fieldLoading}>
            <img src="/assets/icons/switch.svg" alt="Switch" />
          </button>
        </div>
        <div className="form-field">
          <TokenField data={formData.to} tokensList={tokenBalanceList}
                      excludedToken={formData.from.token}
                      setTokenData={handleTokenData}
                      maxAmount={MAX_AMOUNT}
                      loading={fieldLoading}
                      disabled={true}
                      label="To" type="to"></TokenField>
        </div>
      </div>
      {transactionStates.length > 0 && <div className="form-group">
        <div className="form-field">
          {transactionStates.map((state, key) => {
            return <SwapState key={key} formState={state} loading={loading}
                              executeState={executeTransactionState}
                              setLoading={setLoading}
                              transactionCancel={cancelTransaction}></SwapState>;
          })}
        </div>
      </div>}
      {error.length > 0 && <div className="form-error">{error}</div>}
      <div className="form-group">
        <div className="form-field">
          <button className="form-button" onClick={handleSubmit} disabled={formDisabled}>
            {buttonText}
          </button>
        </div>
      </div>
    </>
  );
};

export default SwapForm;
