import React, { useMemo, useState } from 'react';
import AmountInput from 'react-currency-input-field';
import { Big } from 'big.js';
import { CTokenBalance } from '../../../models';
import { tokenIcons } from '../../../data/tokens';
import TokensModal from '../TokensModal/TokensModal';
import './TokenField.css';

type Props = {
  data: {
    token: string;
    amount: string;
  },
  type: 'from' | 'to';
  maxAmount: number;
  label: string;
  tokensList: CTokenBalance[];
  excludedToken: string;
  disabled: boolean;
  loading: boolean;
  setTokenData(type: 'from' | 'to', data: { token: string; amount: string; }): void;
};

export const TokenField: React.FC = (props: Props) => {
  const {
    data, tokensList, type,
    label, setTokenData, excludedToken, disabled, loading, maxAmount
  } = props;
  const [openModal, setOpenModal] = useState(false);

  const tokenIcon = useMemo(() => {
    const symbol = data.token.toLowerCase();
    const icon = tokenIcons.hasOwnProperty(symbol) ? tokenIcons[symbol] : 'token.png';
    return `/tokens/${icon}`;
  }, [data]);

  const tokenBalance = useMemo(() => {
    const symbol = data.token ? data.token : '';
    const id = tokensList.findIndex(i => i.token.symbol === symbol);
    if (id > -1) {
      const token = tokensList[id];
      const balance = token.balance?.uiAmount ?? '';
      return balance ? balance : '0';
    }
    return `0`;
  }, [data, tokensList]);

  const token = useMemo(() => {
    const symbol = data.token ? data.token : '';
    const id = tokensList.findIndex(i => i.token.symbol === symbol);
    if (id > -1) {
      const token = tokensList[id];
      return token.token;
    }
    return null;
  }, [data, tokensList]);

  const tokenName = useMemo(() => {
    return token?.name;
  }, [token]);

  const handleOpenModal = (): void => {
    setOpenModal(true);
  };

  const handleCloseModal = (token?: CTokenBalance): void => {
    if (token) {
      const amount = data.amount ? new Big(new Big(data.amount).toFixed(token.token.decimals)).toString() : '';
      setTokenData(type, { amount, token: token.token.symbol });
    }
    setOpenModal(false);
  };

  const handleInput = (amount: string): void => {
    const b = Number(amount);
    const a = b < 0 ? '0' : b > maxAmount ? maxAmount.toString() : amount;
    const c = a ? a : '';
    setTokenData(type, { amount: c, token: data.token });
  };

  const handleWallet = async (): Promise<bigint> => {
  };

  return (
    <>
      <div className="form-label">
        <label>{label}</label>
        <div className="wallet-amount">
          <div className="button-back" onClick={handleWallet}>
            <img src="/assets/icons/wallet.svg" alt="" />
          </div>
          <span className="amount">{tokenBalance}</span>
        </div>
      </div>
      <div className="token-field">
        <div className="token-field-item icon">
          <button type="button" className="token-button" onClick={handleOpenModal}>
            <div className="token-icon">
              <img src={tokenIcon} width="36px" height="36px" alt="" />
            </div>
            <span className="token-name whitespace-nowrap">{tokenName}</span>
          </button>
        </div>
        <div className="token-field-item amount w-full relative">
          {loading && <div className="absolute right-[-18px] top-[9px] animate-spin">
            <img src="/assets/icons/loading.svg" width="15px" height="15px" alt="" />
          </div>}
          <AmountInput decimalsLimit={token?.decimals} onValueChange={handleInput}
                       value={data.amount} placeholder="0.00" disabled={disabled}
                       className={`transition-all ${loading ? 'opacity-75' : ''}`}
                       intlConfig={{ locale: 'en-UA' }} />
        </div>
      </div>
      <TokensModal excludedToken={excludedToken} tokensList={tokensList} openModal={openModal}
                   closeModal={handleCloseModal} />
    </>
  );
};
