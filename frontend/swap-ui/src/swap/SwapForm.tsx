import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { delay, logJson, NeonAddress, ScheduledTransactionStatus } from '@neonevm/solana-sign';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TokenField } from './components/TokenField/TokenField';
import SwapState from './components/SwapState/SwapState';
import { useProxyConnection } from '../wallet/Connection';
import { CTokenBalance, FormState, SwapTokensResponse, TransactionGas } from '../models';
import { approveTokensMultiple, withdrawTokensMultiple } from '../api/swap';
import { swap, tokensList } from '../data/tokens';
import './SwapForm.css';

interface FormData {
  from: { token: string, amount: string },
  to: { token: string, amount: string },
}

const DURATION = 3e5;
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
  const [error, setError] = useState<string>(``);

  const formValidation = useMemo((): boolean => {
    const { from, to } = formData;
    const tokenFrom = tokenBalanceList.find(t => t.token.symbol === formData.from.token)!;
    return !from.amount || !to.amount || !tokenFrom?.balance?.amount;
  }, [formData, tokenBalanceList]);

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

  const pancakePair = useMemo<NeonAddress>(() => {
    const tokenFrom = tokensList.find(t => t.symbol === formData.from.token)!;
    const tokenTo = tokensList.find(t => t.symbol === formData.to.token)!;
    const pair = `${tokenFrom.symbol}/${tokenTo.symbol}`.toLowerCase();
    return swap.pairs[pair];
  }, [formData.from.token, formData.to.token]);

  const formDisabled = useMemo<boolean>(() => {
    return !publicKey || !pancakePair || formValidation || loading;
  }, [formValidation, loading, pancakePair, publicKey]);

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

  const approveAndSwap = async (nonce: number, transactionGas: TransactionGas): Promise<SwapTokensResponse> => {
    const tokenFrom = tokensList.find(t => t.symbol === formData.from.token)!;
    const tokenTo = tokensList.find(t => t.symbol === formData.to.token)!;
    const amountFrom = Number(formData.from.amount);
    const amountTo = Number(formData.to.amount);
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

  const withdrawTokens = async (nonce: number, transactionGas: TransactionGas): Promise<SwapTokensResponse> => {
    const tokenFrom = tokensList.find(t => t.symbol === formData.from.token)!;
    const tokenTo = tokensList.find(t => t.symbol === formData.to.token)!;
    const amountFrom = Number(formData.from.amount);
    const amountTo = Number(formData.to.amount);
    const pair = `${tokenFrom.symbol}/${tokenTo.symbol}`.toLowerCase();
    const pancakePair = swap.pairs[pair];
    const pancakeRouter: NeonAddress = swap.router;

    return withdrawTokensMultiple({
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
      setError('');
      const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
      const { maxPriorityFeePerGas: a, maxFeePerGas: b } = await proxyApi.getMaxFeePerGas();
      const { scheduledTransaction, transactions } = await state.method(nonce, {
        maxPriorityFeePerGas: a,
        maxFeePerGas: b,
        gasLimit: [1e7, 1e7, 1e7] // 10_000_000
      });
      changeTransactionStates(state);
      const signature = await sendTransaction(scheduledTransaction);
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
      const [one, two] = transactionStates;
      if (state.id === two.id) {
        if (!one.isCompleted) {
          return;
        }
      }
      console.log(`Run transaction ${state.title}`);
      await executeTransactionState(state);
      await delay(1e3);
    }
  };

  const handleSubmit = async () => {
    try {
      const approveState: FormState = {
        id: 0,
        title: `Approve ans Swap tokens`,
        status: `NotStarted`,
        signature: ``,
        isCompleted: false,
        method: approveAndSwap,
        data: undefined
      };
      const swapState: FormState = {
        id: 1,
        title: `Withdraw tokens to Solana wallet`,
        status: `NotStarted`,
        signature: ``,
        isCompleted: false,
        method: withdrawTokens,
        data: undefined
      };
      transactionsRef.current = [approveState, swapState];
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
    setFormData({ from: to, to: from });
    setError('');
    resetTransactionStates();
    console.log(JSON.stringify(formData));
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
            console.log(e);
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
    }
  }, [connected]);

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
    </div>
  );
};

export default SwapForm;
