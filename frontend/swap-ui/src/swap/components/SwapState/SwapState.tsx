import React, { FC, useMemo } from 'react';
import { FormState } from '../../../models';
import './SwapState.css';
import { ScheduledTransactionStatus } from '@neonevm/solana-sign/dist/types/models/api';
import { SOLANA_URL } from '../../../environments';


const Status: FC = ({ formState, loading }: { formState: FormState, loading: boolean }) => {
  const status = useMemo(() => {
    const data = formState.data;
    if (data) {
      switch (data.activeStatus) {
        case 'NotStarted':
          return 'loading-gray';
        case 'InProgress':
          return 'loading';
        case 'Success':
          return 'success';
        case 'Empty':
        case 'Failed':
        case 'Skipped':
          return 'warning';
      }
    }
    if (loading) {
      return `loading-gray`;
    }
    return ``;
  }, [formState.data, loading]);

  return (
    <>
      {loading && <div className="form-state-loading">
        {status === 'loading-gray' &&
          <img className="loading" src="/assets/icons/loading-gray.svg" alt="Loading..." />}
        {status === 'loading' &&
          <img className="loading" src="/assets/icons/loading.svg" alt="Loading..." />}
        {status === 'success' && <img src="/assets/icons/check.svg" alt="Success" />}
        {status === 'warning' && <img src="/assets/icons/warning.svg" alt="Warning" />}
      </div>}
    </>
  );
};

function SwapState({ formState, loading, executeState, setLoading, transactionCancel }: {
  formState: FormState,
  loading: boolean,
  setLoading: (size: boolean) => void,
  executeState: (state: FormState) => Promise<void>
  transactionCancel: (state: ScheduledTransactionStatus) => Promise<void>
}) {
  const show = false;
  const handleCancel = async (trx: ScheduledTransactionStatus): Promise<void> => {
    if (!loading) {
      await transactionCancel(trx);
    }
  };

  const handleStart = async (): Promise<void> => {
    if (!loading) {
      formState.status = 'NotStarted';
      formState.isCompleted = false;
      formState.data = undefined;
      formState.signature = '';
      await executeState(formState);
      setLoading(false);
    }
  };

  const canRestart = useMemo(() => {
    return !loading && ['Empty', 'Failed', 'Skipped', 'Empty'].includes(formState.status);
  }, [loading, formState]);

  const canStart = useMemo(() => {
    return !loading && ['NotStarted'].includes(formState.status);
  }, [loading, formState]);

  const showLink = (trx: ScheduledTransactionStatus): boolean => {
    return ['Success', 'Empty', 'Failed', 'Skipped'].includes(trx.status);
  }

  return (
    <div className="form-state">
      <div className="form-state-title">
        <div className="form-state-title-item title">
          <div className="form-state-number">{formState.id + 1}</div>
          <div className="title">{formState.title}</div>
          {formState.signature?.length > 0 &&
            <a href={`https://explorer.solana.com/tx/${formState.signature}?cluster=custom&customUrl=${SOLANA_URL}`} target="_blank">
              {/*<a href={`https://solscan.io/tx/${formState.signature}?cluster=devnet`} target="_blank">*/}
              <img src="/assets/solscan.webp" width={18} height={18} alt="" />
            </a>}
        </div>
        <div className="form-state-title-item loading">
          {canRestart &&
            <button className={'button-restart'} onClick={handleStart}>Restart</button>}
          {canStart &&
            <button className={'button-restart'} onClick={handleStart}>Start</button>}
          <Status formState={formState} loading={loading} />
        </div>
      </div>
      {!!formState.data && formState.data?.transactions?.length > 0 && <>
        <div className="form-state-body">
          {formState.data.transactions.map((trx, key) => {
            return <div className="form-state-transaction" key={key}>
              <div className="transaction-item">
                {showLink(trx) ? <a href={`https://devnet.neonscan.org/tx/${trx.transactionHash}`} target='_blank'>{trx.transactionHash}</a>
                : <span>{trx.transactionHash}</span>}
              </div>
              <div className="transaction-item">
                {show && trx.status === 'NotStarted' &&
                  <button onClick={() => handleCancel(trx)}>x</button>}
                <div>{trx.status}</div>
              </div>
            </div>;
          })}
        </div>
      </>}
    </div>
  );
}

export default SwapState;
