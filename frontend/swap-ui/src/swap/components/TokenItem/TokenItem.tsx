import React, { useMemo } from 'react';
import { tokenIcons } from '../../../data/tokens';
import { useProxyConnection } from '../../../wallet/Connection';
import { CTokenBalance } from '../../../models';
import './TokenItem.css';

function TokenItem({ token, loading, state, tokenSelect, tokenAirdrop }: {
  token: CTokenBalance;
  loading: boolean;
  state: 'loading' | 'success' | 'failed' | 'none';
  tokenSelect(token: CTokenBalance);
  tokenAirdrop(token: CTokenBalance);
}) {
  const { addresses } = useProxyConnection();

  const tokenName = useMemo(() => {
    return token.token.name ? token.token.name : '';
  }, [token]);

  const tokenSymbol = useMemo(() => {
    return token.token.symbol ? token.token.symbol : '';
  }, [token]);

  const tokenBalance = useMemo(() => {
    const symbol = token.token.symbol ? token.token.symbol : '';
    const balance = token.balance?.uiAmount ?? '';
    return balance ? `${balance} ${symbol}` : '0';
  }, [token, token.balance]);

  const tokenIcon = useMemo(() => {
    const symbol = tokenSymbol.toLowerCase();
    const icon = tokenIcons.hasOwnProperty(symbol) ? tokenIcons[symbol] : 'token.png';
    return `/tokens/${icon}`;
  }, [tokenSymbol]);

  const showAirdrop = useMemo(() => {
    return !!addresses.airdrop?.includes(token.token.address_spl);
  }, [addresses.airdrop, token.token.address_spl]);

  const handleSelect = (): void => tokenSelect(token);
  const handleAirdrop = (): void => tokenAirdrop(token);

  return (
    <div className="flex items-center flex-row gap-[6px] w-full">
      <button type="button" className="token-item" onClick={handleSelect} disabled={loading}>
        <div className="token-content">
          <div className="token-icon">
            <img src={tokenIcon} width="36px" height="36px" alt={tokenSymbol} />
          </div>
          <div className="token-name">{tokenName}</div>
        </div>
        <div className="token-amount">{tokenBalance}</div>
      </button>
      {showAirdrop &&
        <button type="button" className="button-airdrop" onClick={handleAirdrop} disabled={loading}
                title="Request tokens">
          {state === 'none' && <img src="/assets/icons/gift.svg" alt="Gift..." />}
          {state === 'loading' && <div className="animate-spin">
            <img src="/assets/icons/loading.svg" alt="Loading..." />
          </div>}
          {state === 'success' && <img src="/assets/icons/check.svg" alt="Success" />}
          {state === 'failed' && <img src="/assets/icons/warning.svg" alt="Failed" />}
        </button>}
    </div>
  );
}

export default TokenItem;
