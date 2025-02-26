import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import Layout from '../layout/Layout.tsx';
import SwapForm from '../swap/SwapForm.tsx';
import FormTabs from '../swap/components/FormTabs/FormTabs.tsx';
import { useProxyConnection } from '../wallet/Connection.tsx';
import { UITab } from '../models';
import './App.css';
import { approveSwapAndWithdrawTokensMultiple, swapTokensMultipleV2 } from '../api/swap';
import { tokens } from '../data/tokens';
import { PROXY_ENV } from '../environments';

const { tokensV2, tokensV1 } = tokens(PROXY_ENV);

function App() {
  const tabs: UITab[] = [
    { id: 0, title: 'v1', disabled: false },
    { id: 1, title: 'v1-2', disabled: true },
    { id: 2, title: 'v2', disabled: false }
  ];
  const [tab, setTab] = useState<UITab>(tabs[0]);
  const { publicKey } = useWallet();
  const { getWalletBalance } = useProxyConnection();

  const handleSelect = (tab: UITab): void => {
    setTab(_ => tab);
  };


  useEffect(() => {
    getWalletBalance().catch(console.log);
  }, [publicKey]);

  return (
    <>
      <Layout>
        <div className="max-w-[624px]">
          <FormTabs tabs={tabs} tab={tab} selectTab={handleSelect}></FormTabs>
          {tab.id === 0 && <SwapForm tokensList={tokensV1} swapMethod={approveSwapAndWithdrawTokensMultiple}></SwapForm>}
          {tab.id === 1 && <SwapForm tokensList={tokensV2} swapMethod={swapTokensMultipleV2}></SwapForm>}
          {tab.id === 2 && <SwapForm tokensList={tokensV2} swapMethod={swapTokensMultipleV2}></SwapForm>}
        </div>
      </Layout>
    </>
  );
}

export default App;
