import React from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import './layout.css';

const Header = () => {
  return <header className={'flex flex-row justify-center transition z-10'}>
    <div className={'flex flex-row items-left justify-between w-full max-w-2xl p-2'}>
      <div className="logo">
        <img src="/assets/logo.svg" width="32" height="32" alt="Neon" />
        <span>Neon <strong>Swap</strong></span>
      </div>
      <WalletMultiButton />
    </div>
  </header>;
};

export default Header;
