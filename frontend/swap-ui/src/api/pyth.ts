import {
  getPythClusterApiUrl,
  getPythProgramKeyForCluster,
  PythCluster,
  PythHttpClient
} from '@pythnetwork/client';
import { Connection } from '@solana/web3.js';

export function pythInit(): PythHttpClient {
  const clusterName: PythCluster = 'pythnet';
  const connection: Connection = new Connection(getPythClusterApiUrl(clusterName));
  const pythPublicKey = getPythProgramKeyForCluster(clusterName);
  return new PythHttpClient(connection, pythPublicKey);
}
