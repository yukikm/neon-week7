export const addressesCurvestand = {
  tokensV1: [
    {
      'address': '0x3b797f94F7C49B58D7d6b67b8bDB33331d8569d3',
      'address_spl': 'HPsV9Deocecw3GeZv1FkAPNCBRfuVyfw9MMwjwRe1xaU',
      'name': 'Wrapped NEON',
      'symbol': 'wNEON',
      'decimals': 18
    },
    {
      'address': '0xC3529Db933f3D28323CD825c666CBBAf5BDbF7f8',
      'address_spl': '2v1k5gUDkBHp2F3LnPrFJwqjnRb2CUCobVLgP1hK7m3s',
      'name': 'Token A',
      'symbol': 'TOKEN_A',
      'decimals': 9
    },
    {
      'address': '0x0503Be7119b775BFC519c4F489C8D52521fEA207',
      'address_spl': '5cR4Gk8kWU2UMXnhLW59pFewwrYuTuZmYbTmGRPSQHBv',
      'name': 'Token B',
      'symbol': 'TOKEN_B',
      'decimals': 12
    }
  ],
  tokensV2: [
    {
      'address': '0x60e1D2e0f8950ca9b955fd89791B886C09539633',
      'address_spl': 'BRnwhjNz9x6294Ju4GcS98qBw2zBz7fs2LZRRq7SLhXL',
      'name': 'Token A (v2)',
      'symbol': 'TOKEN_Av2',
      'decimals': 9
    },
    {
      'address': '0x2D6970930469599Cbb69cF59eDBab2B70fe948dB',
      'address_spl': 'DMu3AQ38drunkBDQcP82gnVM2dGobF9gBvxNUuoFYBkS',
      'name': 'Token B (v2)',
      'symbol': 'TOKEN_Bv2',
      'decimals': 9
    }
  ],
  swap: {
    'router': '0x1Be1a24E9BF504b35901c1b76fBf77766D6b7647',
    'factory': '0xb3bFD57D36D09209fFF3B5D4052c9c271FE11AAc',
    'pairs': {
      'wneon/token_a': {
        'pair': '0x012CA297AEa774b96b6A6E12B9D45fAc97D0aD94',
        'a': '0x3b797f94F7C49B58D7d6b67b8bDB33331d8569d3',
        'b': '0xC3529Db933f3D28323CD825c666CBBAf5BDbF7f8'
      },
      'token_a/wneon': {
        'pair': '0x012CA297AEa774b96b6A6E12B9D45fAc97D0aD94',
        'a': '0x3b797f94F7C49B58D7d6b67b8bDB33331d8569d3',
        'b': '0xC3529Db933f3D28323CD825c666CBBAf5BDbF7f8'
      },
      'wneon/token_b': {
        'pair': '0x4758EA4f4fc6A94194e31ca2a2BfA7F173BcDAA9',
        'a': '0x0503Be7119b775BFC519c4F489C8D52521fEA207',
        'b': '0x3b797f94F7C49B58D7d6b67b8bDB33331d8569d3'
      },
      'token_b/wneon': {
        'pair': '0x4758EA4f4fc6A94194e31ca2a2BfA7F173BcDAA9',
        'a': '0x0503Be7119b775BFC519c4F489C8D52521fEA207',
        'b': '0x3b797f94F7C49B58D7d6b67b8bDB33331d8569d3'
      },
      'token_a/token_b': {
        'pair': '0x9b8454d105cC5Dc0324dA9e96a0e754Cbc428A40',
        'a': '0x0503Be7119b775BFC519c4F489C8D52521fEA207',
        'b': '0xC3529Db933f3D28323CD825c666CBBAf5BDbF7f8'
      },
      'token_b/token_a': {
        'pair': '0x9b8454d105cC5Dc0324dA9e96a0e754Cbc428A40',
        'a': '0x0503Be7119b775BFC519c4F489C8D52521fEA207',
        'b': '0xC3529Db933f3D28323CD825c666CBBAf5BDbF7f8'
      },
      'token_av2/token_bv2': {
        pair: '0x80710AFDCbB471EfC5e9511F6Ce8D73e1B6f592b',
        a: '0x2D6970930469599Cbb69cF59eDBab2B70fe948dB',
        b: '0x60e1D2e0f8950ca9b955fd89791B886C09539633'
      },
      'token_bv2/token_av2': {
        pair: '0x80710AFDCbB471EfC5e9511F6Ce8D73e1B6f592b',
        a: '0x2D6970930469599Cbb69cF59eDBab2B70fe948dB',
        b: '0x60e1D2e0f8950ca9b955fd89791B886C09539633'
      }
    }
  },
  transfer: {
    'neonTokenTransfer': '0xA4C62831B47C0Bb3a0cF569B7a22A41749a48ED7'
  }
};
