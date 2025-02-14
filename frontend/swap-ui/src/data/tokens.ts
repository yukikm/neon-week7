import { addresses } from './addresses.ts';
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
  let swap: unknown = addresses.swap;
  let tokensList: CSPLToken[] = addresses.tokens;

  if (PROXY_ENV === 'devnet') {
    swap = {
      router: '0x9c58018c0599153cDCF5cEA9F1512f58dcFbF7a6',
      factory: '0x2b76CBDfaE4EC1605E510587815d09343378c633',
      pairs: {
        'usdc/wneon': '0x80935329FCC9ace53177F0E91026668EB0c09C7E',
        'wneon/usdc': '0x80935329FCC9ace53177F0E91026668EB0c09C7E',
        'usdc/wsol': '0x5ec7becAB1289302e76f6c06aadc486AfB82Dadf',
        'wsol/usdc': '0x5ec7becAB1289302e76f6c06aadc486AfB82Dadf',
        'wneon/v1token': '0xE036225B170611fF55D981db73Db0Fa7BA3dbe31',
        'v1token/wneon': '0xE036225B170611fF55D981db73Db0Fa7BA3dbe31'
      }
    };
    tokensList = [
      {
        address: '0x512E48836Cd42F3eB6f50CEd9ffD81E0a7F15103',
        address_spl: 'F4DgNXqiT3zUQA7dhqN5VzEPkRcd8vtqFwpJSwEEvnz5',
        name: 'USDC',
        symbol: 'USDC',
        decimals: 6
      },
      {
        address: '0xc7Fc9b46e479c5Cb42f6C458D1881e55E6B7986c',
        address_spl: 'So11111111111111111111111111111111111111112',
        name: 'Wrapped SOL',
        symbol: 'wSOL',
        decimals: 9
      },
      {
        address: '0x7a8F86eB7f15111c6bD2BfC57c7616fC12D56284',
        address_spl: `5UMhuc2A58xPAPdtLGuYt7SyEQ1pRnyEGDf1fdzJGe4U`, // ???
        name: 'Token v1',
        symbol: 'v1TOKEN',
        decimals: 9
      },
      {
        address: '0x11adC2d986E334137b9ad0a0F290771F31e9517F',
        address_spl: '89dre8rZjLNft7HoupGiyxu3MNftR577ZYu8bHe2kK7g',
        name: 'Wrapped Neon',
        symbol: 'wNEON',
        decimals: 9
      }
    ];
  }

  return { swap, tokensList };
}

const { swap, tokensList } = data();

export {
  swap,
  tokensList
};
