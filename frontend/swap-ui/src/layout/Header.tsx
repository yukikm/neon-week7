import React, { useEffect, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import './layout.css';
import { useProxyConnection } from '../wallet/Connection.tsx';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

const Header = () => {
  const {} = useProxyConnection();
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    const getBalance = async () => {
      if (publicKey && connection) {
        const b = await connection.getBalance(publicKey);
        if (b) {
          setBalance(b);
        }
      } else {
        setBalance(0);
      }
    };
    getBalance();
  }, [publicKey, connection]);

  return <header className={'flex flex-row justify-center transition z-10'}>
    <div className={'flex flex-row items-left justify-between w-full max-w-2xl p-2'}>
      <div className="logo">
        <img src="/assets/logo.svg" width="32" height="32" alt="Neon" />
        <span><strong>Swap</strong> Demo</span>
      </div>
      <div className={'flex flex-row gap-[8px] items-center'}>
        <div className="balance">{balance > 0 && `${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL`}</div>
        <WalletMultiButton />
      </div>
    </div>
  </header>;
};

export default Header;
