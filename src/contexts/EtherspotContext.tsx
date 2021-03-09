import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Sdk as EtherspotSdk,
  NetworkNames as EtherspotNetworkNames,
  MetaMaskWalletProvider,
  SessionStorage,
  StoredSession,
  EnvNames,
  NotificationTypes,
  GatewayTransactionStates,
  WalletConnectWalletProvider,
} from 'etherspot';
import {
  JsonRpcProvider,
} from '@ethersproject/providers';
import { map } from 'rxjs/operators';
import { WalletConnectConnector } from '@web3-react/walletconnect-connector';
import { InjectedConnector } from '@web3-react/injected-connector';
import { useWeb3React } from '@web3-react/core';
// eslint-disable-next-line import/no-cycle
import {
  useActiveWeb3React,
} from '../hooks';

class LocalSessionStorage extends SessionStorage {
  setSession = async (walletAddress: string, session: StoredSession) => {
    if (walletAddress) {
      localStorage.setItem(`@session:${walletAddress}`, JSON.stringify(session))
    }
  }

  // @ts-ignore
  getSession = (walletAddress: string) => {
    let result = null

    try {
      const raw = localStorage.getItem(`@session:${walletAddress}`)
      result = raw ? JSON.parse(raw) : null
    } catch (err) {
      //
    }

    return result
  }

  resetSession = (walletAddress: string) => {
    localStorage.setItem(`@session:${walletAddress}`, '')
  }
}
const sessionStorageInstance = new LocalSessionStorage();

class EtherspotRpcProvider extends JsonRpcProvider {
  etherspotWalletProvider

  etherspotSdk: EtherspotSdk

  constructor(url, etherspotSdk, etherspotWalletProvider) {
    super(url);
    this.etherspotSdk = etherspotSdk;
    this.etherspotWalletProvider = etherspotWalletProvider;
  }

  async send(method, params) {
    if (method === 'eth_sendTransaction') {
      this.etherspotSdk.clearGatewayBatch()

      const [{ to, value, data }] = params

      await this.etherspotSdk.batchExecuteAccountTransaction({
        to,
        value,
        data,
      });

      const estimated = await this.etherspotSdk.estimateGatewayBatch();
      console.log('estimated: ', estimated)

      // throw err
      const batchTransactionHash = await this.etherspotSdk
      .submitGatewayBatch()
      .then(({ hash }) => hash)

      if (!batchTransactionHash) {
        throw Error('failed to send');
      }

      let transactionSubscription;

      return new Promise((resolve, reject) => {
        transactionSubscription = this.etherspotSdk.notifications$
          .pipe(map(async (notification) => {
            if (notification.type === NotificationTypes.GatewayBatchUpdated) {
              const submittedBatch = await this.etherspotSdk.getGatewaySubmittedBatch({ hash: batchTransactionHash });
              const failedStates = [
                GatewayTransactionStates.Canceling,
                GatewayTransactionStates.Canceled,
                GatewayTransactionStates.Reverted,
              ];
              let complete;
              if (submittedBatch?.transaction?.state
                && failedStates.includes(submittedBatch?.transaction?.state)) {
                complete = () => reject(submittedBatch.transaction.state);
              } else if (submittedBatch?.transaction?.hash !== null) {
                complete = () => resolve(submittedBatch?.transaction?.hash)
              }
              if (complete) {
                if (transactionSubscription) transactionSubscription.unsubscribe()
                complete();
              }
            }
          }))
          .subscribe()
      });
    }

    return super.send(method, params);
  }
}

const sdkChainId: number = parseInt(process.env.REACT_APP_CHAIN_ID || '56');

export const EtherspotContext = React.createContext(null)

export const EtherspotContextProvider = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null)
  const [etherspotWalletProvider, setEtherspotWalletProvider] = useState<MetaMaskWalletProvider | WalletConnectWalletProvider | null>(null)

  const { activate: activateWeb3, deactivate: deactivateWeb3, chainId: web3ChainId } = useWeb3React()
  const { library: activeWeb3Library } = useActiveWeb3React();

  const etherspotSdk = useMemo(() => {
    if (!etherspotWalletProvider) return null

    const { Bsc, BscTest } = EtherspotNetworkNames;
    const { MainNets, TestNets } = EnvNames;
    const networkName = sdkChainId === 56 ? Bsc : BscTest;
    const envName = networkName === Bsc ? MainNets : TestNets;

    return new EtherspotSdk(etherspotWalletProvider, {
      networkName,
      env: envName,
      // @ts-ignore
      sessionStorage: sessionStorageInstance,
      omitWalletProviderNetworkCheck: true,
    });
  }, [etherspotWalletProvider])

  const web3ProviderOnBscChain = [56, 97].includes(web3ChainId || 0)

  const activate = useCallback(async (connector) => {
    setEtherspotWalletProvider(null)

    await activateWeb3(connector)

    // if web3 provider us on bsc chain then let's allow web3 connector
    const etherspotSupportedProvider = connector instanceof WalletConnectConnector
      || connector instanceof InjectedConnector

    if (!web3ProviderOnBscChain && etherspotSupportedProvider) {
      const etherspotProvider = connector instanceof WalletConnectConnector
        // @ts-ignore
        ? await WalletConnectWalletProvider.connect(connector.walletConnectProvider)
        : await MetaMaskWalletProvider.connect().catch(() => null)

      if (etherspotProvider) {
        setEtherspotWalletProvider(etherspotProvider)
      }
    }
  }, [web3ProviderOnBscChain, activateWeb3])

  useEffect(() => {
    if (etherspotWalletProvider && etherspotSdk) {
      etherspotSdk.computeContractAccount({ sync: true })
        .then(({ address }) => {
          setAccount(address)
        })
        .catch(() => null)
    }
  }, [etherspotSdk, etherspotWalletProvider])

  const deactivate = useCallback(() => {
    deactivateWeb3()

    if (etherspotSdk) {
      if (account) sessionStorageInstance.resetSession(account)
      etherspotSdk.destroy()
    }

    setEtherspotWalletProvider(null)
    setAccount(null)
  }, [etherspotSdk, account, deactivateWeb3]);

  const provider = useMemo(
    () => activeWeb3Library && !etherspotWalletProvider
      ? activeWeb3Library
      : new EtherspotRpcProvider(process.env.REACT_APP_NETWORK_URL, etherspotSdk, etherspotWalletProvider),
    [etherspotSdk, etherspotWalletProvider, activeWeb3Library],
  );

  const etherspot = useMemo(() => ({
    library: provider,
    account,
    deactivate,
    activate,
    active: !web3ProviderOnBscChain,
  }), [account, provider, activate, deactivate, web3ProviderOnBscChain])

  // @ts-ignore
  return <EtherspotContext.Provider value={{ etherspot }}>{children}</EtherspotContext.Provider>
}
