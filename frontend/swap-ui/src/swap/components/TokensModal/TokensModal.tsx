import { useMemo } from 'react';
import Modal from 'react-modal';
import './TokensModal.css';
import { CTokenBalance } from '../../../models';
import TokenItem from '../TokenItem/TokenItem';

Modal.setAppElement('#root');

interface Props {
  openModal: boolean;
  closeModal: <T>(t?: T) => void;
  tokensList: CTokenBalance[];
  excludedToken: string;
}

function TokensModal({ openModal, closeModal, tokensList, excludedToken }: Props) {

  const tokenSelect = (token: CTokenBalance): void => {
    closeModal(token);
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
            <TokenItem token={token} tokenSelect={tokenSelect} key={key} />))}
        </div>
      </div>
    </Modal>
  );
}

export default TokensModal;
