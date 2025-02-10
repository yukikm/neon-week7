import React, { useMemo, useState } from 'react';
import AmountInput from 'react-currency-input-field';
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
  label: string;
  tokensList: CTokenBalance[];
  excludedToken: string,
  setTokenData(type: 'from' | 'to', data: { token: string; amount: string; }): void;
};

export const TokenField: React.FC = (props: Props) => {
  const { data, tokensList, type, label, setTokenData, excludedToken } = props;
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
      return balance ? `${balance} ${symbol}` : '0';
    }
    return `0`;
  }, [data, tokensList]);

  const tokenName = useMemo(() => {
    return data.token;
  }, [data]);

  const token = useMemo(() => {
    const symbol = data.token ? data.token : '';
    const id = tokensList.findIndex(i => i.token.symbol === symbol);
    if (id > -1) {
      const token = tokensList[id];
      return token.token;
    }
    return null;
  }, [data, tokensList]);

  const handleOpenModal = (): void => {
    setOpenModal(true);
  };

  const handleCloseModal = (token?: CTokenBalance): void => {
    if (token) {
      setTokenData(type, { ...data, token: token.token.symbol });
    }
    setOpenModal(false);
  };

  const handleInput = (amount: string): void => {
    setTokenData(type, { amount, token: data.token });
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
            <span className="token-name">{tokenName}</span>
          </button>
        </div>
        <div className="token-field-item amount w-full">
          <AmountInput decimalsLimit={9} max={1} onValueChange={handleInput} value={data.amount}
                       placeholder="0.00" disabled />
        </div>
      </div>
      <TokensModal excludedToken={excludedToken} tokensList={tokensList} openModal={openModal}
                   closeModal={handleCloseModal} />
    </>
  );
};
