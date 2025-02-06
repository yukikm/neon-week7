import React, { FC, useMemo } from 'react';
import { FormState } from '../../../models';
import './SwapState.css';


const Status: FC = ({ formState, loading }: { formState: FormState, loading: boolean }) => {
  const status = useMemo(() => {
    if (loading) {
      const data = formState.data;
      if (data) {
        switch (data.activeStatus) {
          case 'NoStarted':
            return 'loading-gray';
          case 'InProgress':
            return 'loading';
          case 'Success':
            return 'success';
          case 'Empty':
          case 'Failed':
            return 'warning';
        }
      }
      return `loading-gray`;
    }
    return '';
  }, [formState.data, loading]);

  return (
    <div className="form-state-loading">
      {status === 'loading-gray' &&
        <img className="loading" src="/assets/icons/loading-gray.svg" alt="Loading..." />}
      {status === 'loading' &&
        <img className="loading" src="/assets/icons/loading.svg" alt="Loading..." />}
      {status === 'success' && <img src="/assets/icons/check.svg" alt="Success" />}
      {status === 'warning' && <img src="/assets/icons/warning.svg" alt="Warning" />}
    </div>
  );
};

function SwapState({ formState, loading }: { formState: FormState, loading: boolean }) {

  return (
    <div className="form-state">
      <div className="form-state-title">
        <div className="form-state-title-item title">{formState.id + 1} {formState.title}</div>
        <div className="form-state-title-item loading">
          <Status formState={formState} loading={loading}></Status>
        </div>
      </div>
      <div className="form-state-body">
        {!!formState.data && formState.data?.transactions?.length > 0 && <>
          {formState.data.transactions.map((trx, key) => {
            return <div className="form-state-transaction" key={key}>
              <div className="transaction-item">{trx.transactionHash}</div>
              <div className="transaction-item">{trx.status}</div>
            </div>;
          })}
        </>}
      </div>
    </div>
  );
}

export default SwapState;
