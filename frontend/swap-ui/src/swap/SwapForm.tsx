import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import React, { useEffect, useMemo, useState } from 'react';
import { TokenField } from './components/TokenField/TokenField.tsx';
import { tokensList } from '../data/tokens.ts';
import { CTokenBalance } from '../models';
import './SwapForm.css';

interface FormData {
  from: { token: string, amount: string },
  to: { token: string, amount: string },
}

export const SwapForm: React.FC = () => {
  const { connected, publicKey, signTransaction } = useWallet();
  const [tokenBalanceList, setTokenBalanceList] = useState<CTokenBalance[]>([]);
  const { connection } = useConnection();
  const [one, two] = tokensList;
  const [formData, setFormData] = useState<FormData>({
    from: { token: one.symbol!, amount: '' },
    to: { token: two.symbol!, amount: '' }
  });

  const handleSubmit = async () => {
    console.log(formData);
  };

  const formValidation = useMemo((): boolean => {
    const { from, to } = formData;
    return from.amount?.length === 0 || to.amount?.length === 0;
  }, [formData]);

  const buttonText = useMemo((): string => {
    const { from, to } = formData;
    if (!connected) {
      return `Connect wallet`;
    }
    if (from.amount?.length === 0 || to.amount?.length === 0) {
      return `Enter an amount`;
    }
    return `Swap`;
  }, [formData, connected]);

  const handleSwitch = () => {
    const { from, to } = formData;
    setFormData({ from: to, to: from });
    console.log(JSON.stringify(formData));
  };

  const handleTokenData = (type: 'from' | 'to', value: {
    token: CTokenBalance;
    amount: string;
  }): void => {
    setFormData({ ...formData, [type]: value });
  };

  useEffect(() => {
    const getBalance = async (): Promise<any> => {
      const tokens: CTokenBalance[] = [];
      for (const token of tokensList) {
        const cTokenBalance: CTokenBalance = { token, balance: undefined };
        if (publicKey) {
          const tokenMint = new PublicKey(token.address_spl);
          const tokenAddress = getAssociatedTokenAddressSync(tokenMint, publicKey);
          const { value: balance } = await connection.getTokenAccountBalance(tokenAddress);
          cTokenBalance['balance'] = balance;
        }
        tokens.push(cTokenBalance);
      }
      setTokenBalanceList(tokens);
    };

    getBalance().catch(console.log);
  }, [publicKey]);

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
      <div className="form-group">
        <div className="form-field">
          <button className="form-button" onClick={handleSubmit} disabled={formValidation}>
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SwapForm;
