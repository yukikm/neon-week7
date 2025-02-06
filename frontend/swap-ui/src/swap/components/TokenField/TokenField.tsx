import React, { useMemo, useState } from 'react';
import AmountInput from 'react-currency-input-field';
import { tokenIcons } from '../../../data/tokens.ts';
import TokensModal from '../TokensModal/TokensModal.tsx';
import { CTokenBalance } from '../../../models';
import './TokenField.css';
import { useProxyConnection } from '../../../wallet/Connection.tsx';
import { handleTokensBack } from '../../../api/swap.ts';

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
  const {
    provider,
    proxyApi,
    neonEvmProgram,
    solanaUser,
    chainId,
    sendTransaction
  } = useProxyConnection();
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
    const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));

    const transaction = await handleTokensBack({
      provider,
      proxyApi,
      neonEvmProgram,
      solanaUser,
      token: token!,
      nonce,
      chainId
    });
    if (transaction) {
      await sendTransaction(transaction);
      const transactionExecution = await proxyApi.waitTransactionTreeExecution(solanaUser.neonWallet, nonce, 6e4);
      console.log(transactionExecution);
    }
  };

  return (
    <>
      <div className="form-label">
        <label>{label}</label>
        <div className="wallet-amount">
          <button className="button-back" onClick={handleWallet}>
            <img src="/assets/icons/wallet.svg" alt="" />
          </button>
          <span className="amount">{tokenBalance}</span>
        </div>
      </div>
      <div className="token-field">
        <div className="token-field-item icon">
          <button type="submit" className="token-button" onClick={handleOpenModal}>
            <div className="token-icon">
              <img src={tokenIcon} width="36px" height="36px" alt="" />
            </div>
            <span className="token-name">{tokenName}</span>
          </button>
        </div>
        <div className="token-field-item amount w-full">
          <AmountInput decimalsLimit={9} max={10} onValueChange={handleInput} value={data.amount}
                       placeholder="0.00" />
        </div>
      </div>
      <TokensModal excludedToken={excludedToken} tokensList={tokensList} openModal={openModal}
                   closeModal={handleCloseModal} />
    </>
  );
};
