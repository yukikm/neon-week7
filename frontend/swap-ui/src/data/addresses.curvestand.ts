export const addressesCurvestand = {
  'tokensV1': [
/*    {
      'address': '0x3b797f94F7C49B58D7d6b67b8bDB33331d8569d3',
      'address_spl': 'HPsV9Deocecw3GeZv1FkAPNCBRfuVyfw9MMwjwRe1xaU',
      'name': 'Wrapped NEON',
      'symbol': 'wNEON',
      'decimals': 18
    },*/
    {
      'address': '0x0503Be7119b775BFC519c4F489C8D52521fEA207',
      'address_spl': '5cR4Gk8kWU2UMXnhLW59pFewwrYuTuZmYbTmGRPSQHBv',
      'name': 'Token X',
      'symbol': 'TOKEN_X',
      'decimals': 9
    },
    {
      'address': '0xe466BdA993dB07355288799c85dCDC6d2b8Bb397',
      'address_spl': 'BCjyKdb9sPZuqvMwnbUKMqYBuFSwDhe4Jz9x6MR4Qbvn',
      'name': 'Token Y',
      'symbol': 'TOKEN_Y',
      'decimals': 12
    }
  ],
  'tokensV2': [
    {
      'address': '0xB9ceE6f7a0DD67da20fca9A4158B0Efef4ba5577',
      'address_spl': '6QPr8XHKg2ohLg5xWpqNwbqwy6xrWZ7C389Z1hqVrZUD',
      'name': 'Token X (v2)',
      'symbol': 'TOKEN_Xv2',
      'decimals': 9
    },
    {
      'address': '0xa151E99F68684bCD0fb8c1bB64401B4a3D6451e4',
      'address_spl': 'BbsqsEbJW8LD5vvANnXrzs1CvQTAN2cRcTi7dvWaNTcq',
      'name': 'Token Y (v2)',
      'symbol': 'TOKEN_Yv2',
      'decimals': 9
    }
  ],
  'swap': {
    'neonTokenTransfer': '0xb3bFD57D36D09209fFF3B5D4052c9c271FE11AAc',
    'router': '0xC3529Db933f3D28323CD825c666CBBAf5BDbF7f8',
    'factory': '0x1Be1a24E9BF504b35901c1b76fBf77766D6b7647',
    'pairs': {
      'wneon/token_x': {
        'pair': '0xC76b511B6983768190F21545dFEE8E8E76fD1893',
        'x': '0x0503Be7119b775BFC519c4F489C8D52521fEA207',
        'y': '0x3b797f94F7C49B58D7d6b67b8bDB33331d8569d3'
      },
      'token_x/wneon': {
        'pair': '0xC76b511B6983768190F21545dFEE8E8E76fD1893',
        'x': '0x0503Be7119b775BFC519c4F489C8D52521fEA207',
        'y': '0x3b797f94F7C49B58D7d6b67b8bDB33331d8569d3'
      },
      'wneon/token_y': {
        'pair': '0x405E182f36310a30cb5Cf49E336403fd5922AAE9',
        'x': '0x3b797f94F7C49B58D7d6b67b8bDB33331d8569d3',
        'y': '0xe466BdA993dB07355288799c85dCDC6d2b8Bb397'
      },
      'token_y/wneon': {
        'pair': '0x405E182f36310a30cb5Cf49E336403fd5922AAE9',
        'x': '0x3b797f94F7C49B58D7d6b67b8bDB33331d8569d3',
        'y': '0xe466BdA993dB07355288799c85dCDC6d2b8Bb397'
      },
      'token_x/token_y': {
        'pair': '0xFfa2546537372f2A6AADa9556ca2A77b1CAf6c82',
        'x': '0x0503Be7119b775BFC519c4F489C8D52521fEA207',
        'y': '0xe466BdA993dB07355288799c85dCDC6d2b8Bb397'
      },
      'token_y/token_x': {
        'pair': '0xFfa2546537372f2A6AADa9556ca2A77b1CAf6c82',
        'x': '0x0503Be7119b775BFC519c4F489C8D52521fEA207',
        'y': '0xe466BdA993dB07355288799c85dCDC6d2b8Bb397'
      },
      'token_xv2/token_yv2': {
        'pair': '0xda6a82537348718369E494c8aDed59f1023309bB',
        'x': '0xa151E99F68684bCD0fb8c1bB64401B4a3D6451e4',
        'y': '0xB9ceE6f7a0DD67da20fca9A4158B0Efef4ba5577'
      },
      'token_yv2/token_xv2': {
        'pair': '0xda6a82537348718369E494c8aDed59f1023309bB',
        'x': '0xa151E99F68684bCD0fb8c1bB64401B4a3D6451e4',
        'y': '0xB9ceE6f7a0DD67da20fca9A4158B0Efef4ba5577'
      }
    }
  }
};
