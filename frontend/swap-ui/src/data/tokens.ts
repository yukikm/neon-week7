import { addressesCurvestand } from './addresses.curvestand.ts';
import { addressesDevnet } from './addresses.devnet.ts';
import { PROXY_ENV } from '../environments';
import { CSPLToken } from '../models';

export const tokenIcons: Record<string, string> = {
  sol: 'sol.svg',
  neon: 'neon.svg',
  tstn: 'tstn.png',
  usdc: 'usdc.svg',
  usdt: 'usdt.svg',
  wsol: 'wsol.svg',
  wneon: 'wneon.svg'
};

function data() {
  let swap: unknown = addressesCurvestand.swap;
  let tokensV1: CSPLToken[] = addressesCurvestand.tokensV1;
  let tokensV2: CSPLToken[] = addressesCurvestand.tokensV2;

  if (PROXY_ENV === 'devnet') {
    swap = addressesDevnet.swap;
    tokensV1 = addressesDevnet.tokensV1;
    tokensV2 = addressesDevnet.tokensV2;
  }

  return { swap, tokensV1, tokensV2 };
}

const { swap, tokensV1, tokensV2 } = data();

export {
  swap,
  tokensV1,
  tokensV2
};
