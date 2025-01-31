import React, { useMemo } from 'react';
import { tokenIcons } from '../../../data/tokens.ts';
import { CTokenBalance } from '../../../models';
import './TokenItem.css';

function TokenItem({ token, tokenSelect }: {
  token: CTokenBalance,
  tokenSelect(token: CTokenBalance)
}) {

  const tokenSymbol = useMemo(() => {
    return token.token.symbol ? token.token.symbol : '';
  }, [token]);

  const tokenBalance = useMemo(() => {
    const symbol = token.token.symbol ? token.token.symbol : '';
    const balance = token.balance?.uiAmount ?? '';
    return balance ? `${balance} ${symbol}` : '0';
  }, [token]);

  const tokenIcon = useMemo(() => {
    const symbol = tokenSymbol.toLowerCase();
    const icon = tokenIcons.hasOwnProperty(symbol) ? tokenIcons[symbol] : 'token.png';
    return `/tokens/${icon}`;
  }, [tokenSymbol]);

  const handleSelect = (): void => tokenSelect(token);

  return (
    <button type="button" className="token-item" onClick={handleSelect}>
      <div className="token-content">
        <div className="token-icon">
          <img src={tokenIcon} width="36px" height="36px" alt={tokenSymbol} />
        </div>
        <div className="token-name">{tokenSymbol}</div>
      </div>
      <div className="token-amount">{tokenBalance}</div>
    </button>
  );
}

export default TokenItem;
