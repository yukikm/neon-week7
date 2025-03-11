import { useMemo, useState } from 'react';
import { Transaction } from '@solana/web3.js';
import { SPLToken } from '@neonevm/token-transfer-core';
import { delay } from '@neonevm/solana-sign';
import Modal from 'react-modal';
import bs58 from 'bs58';
import TokenItem from '../TokenItem/TokenItem';
import { tokenAirdropTransaction } from '../../../api/tokens';
import { useProxyConnection } from '../../../wallet/Connection';
import { CTokenBalance } from '../../../models';
import './TokensModal.css';
import { PROXY_ENV } from '../../../environments';

Modal.setAppElement('#root');

interface Props {
  openModal: boolean;
  closeModal: <T>(t?: T) => void;
  tokensList: CTokenBalance[];
  excludedToken: string;

  updateTokenBalance(token: SPLToken): Promise<void>;
}

const TRANSACTION_INTERVAL = 60;

function TokensModal(props: Props) {
  const { openModal, closeModal, tokensList, excludedToken, updateTokenBalance } = props;
  const [loading, setLoading] = useState<boolean>(false);
  const [state, setState] = useState<'loading' | 'success' | 'failed' | 'none'>('none');
  const {
    solanaUser,
    sendTransaction
  } = useProxyConnection();

  const tokenSelect = (token: CTokenBalance): void => {
    closeModal(token);
  };

  const tokenAirdrop = async ({ token }: CTokenBalance): Promise<void> => {
    setLoading(true);
    setState('loading');
    try {
      const {
        transaction,
        message,
        payload
      } = await tokenAirdropTransaction(solanaUser.publicKey, token, PROXY_ENV, 10);
      if (transaction) {
        const recoveredTransaction = Transaction.from(bs58.decode(transaction));
        await sendTransaction(recoveredTransaction);
        await updateTokenBalance(token);
        setState('success');
        await delay(5e4);
      } else if (payload && Object.prototype.hasOwnProperty.call(payload, 'lastTrx')) {
        setState('failed');
        const remainingTime = Math.floor(Date.now() / 1e3) - payload['lastTrx'];
        if (TRANSACTION_INTERVAL - remainingTime > 0) {
          await delay((TRANSACTION_INTERVAL - remainingTime) * 1e3);
        }
      } else {
        throw new Error(message);
      }
    } catch (e) {
      console.log(e);
      setState('failed');
      await delay(TRANSACTION_INTERVAL - 10);
    }
    setLoading(false);
    setState('none');
  };

  const handleCloseModal = (): void => {
    closeModal();
  };

  const tokens = useMemo<CTokenBalance[]>(() => {
    return tokensList.filter(t => t.token.symbol !== excludedToken);
  }, [tokensList, excludedToken]);

  return (
    <Modal isOpen={openModal} onRequestClose={handleCloseModal}
           className="Modal"
           overlayClassName="Overlay"
           contentLabel="Tokens list">
      <div className="tokens-modal">
        <div className="tokens-header">
          <h3>Select token</h3>
          <button className="button-close" type="button" onClick={handleCloseModal}>
            <img src="/assets/icons/close.svg" alt="Close" />
          </button>
        </div>
        <div className="tokens-content">
          {tokens.map(((token, key) =>
            <TokenItem token={token} tokenSelect={tokenSelect} tokenAirdrop={tokenAirdrop} key={key}
                       loading={loading} state={state} />))}
        </div>
      </div>
    </Modal>
  );
}

export default TokensModal;
