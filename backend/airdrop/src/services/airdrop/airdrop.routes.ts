import { Router } from 'express';
import { airdropTransaction } from '@services/airdrop/airdrop.controllers';

const airdropRouter = Router();

airdropRouter.post(``, airdropTransaction);

export { airdropRouter };
