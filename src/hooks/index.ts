import { Web3Provider } from '@ethersproject/providers'
import { ChainId } from '@pancakeswap-libs/sdk'
import { connectorLocalStorageKey } from '@pancakeswap-libs/uikit'
import { useWeb3React as useWeb3ReactCore } from '@web3-react/core'
// eslint-disable-next-line import/no-unresolved
import { Web3ReactContextInterface } from '@web3-react/core/dist/types'
import {
  useContext,
  useEffect,
  useState,
} from 'react';
import { isMobile } from 'react-device-detect'
import { injected } from '../connectors'
import { NetworkContextName } from '../constants'
// eslint-disable-next-line import/no-cycle
import { EtherspotContext } from '../contexts/EtherspotContext';

export const useEtherspotWallet = (): {
  library: Web3Provider,
  chainId: number,
  account: string,
  deactivate,
  activate,
  active: boolean,
  error,
} => {
  const etherspotContext = useContext(EtherspotContext)

  if (etherspotContext === null) {
    throw new Error(
      'useEtherspotWallet() can only be used inside of <EtherspotContextProvider />, ' +
      'please declare it at a higher level.',
    )
  }

  const { etherspot } = etherspotContext

  return etherspot;
}

export function useActiveWeb3React(): Web3ReactContextInterface<Web3Provider> & { chainId?: ChainId } {
  const context = useWeb3ReactCore<Web3Provider>()
  const contextNetwork = useWeb3ReactCore<Web3Provider>(NetworkContextName)
  return context.active ? context : contextNetwork
}

export function useEagerConnect() {
  const { activate, active } = useEtherspotWallet()

  const [tried, setTried] = useState(false)

  useEffect(() => {
    injected.isAuthorized().then((isAuthorized) => {
      const hasSignedIn = window.localStorage.getItem(connectorLocalStorageKey)
      if (isAuthorized && hasSignedIn) {
        // @ts-ignore
        activate(injected, undefined, true).catch(() => {
          setTried(true)
        })
      } else if (isMobile && window.ethereum && hasSignedIn) {
        // @ts-ignore
        activate(injected, undefined, true).catch(() => {
          setTried(true)
        })
      } else {
        setTried(true)
      }
    })
  }, [activate]) // intentionally only running on mount (make sure it's only mounted once :))

  // if the connection worked, wait until we get confirmation of that to flip the flag
  useEffect(() => {
    if (active) {
      setTried(true)
    }
  }, [active])

  return tried
}

/**
 * Use for network and injected - logs user in
 * and out after checking what network theyre on
 */
export function useInactiveListener(suppress = false) {
  const { active, error, activate } = useWeb3ReactCore() // specifically using useWeb3React because of what this hook does

  useEffect(() => {
    const { ethereum } = window

    if (ethereum && ethereum.on && !active && !error && !suppress) {
      const handleChainChanged = () => {
        // eat errors
        activate(injected, undefined, true).catch((e) => {
          console.error('Failed to activate after chain changed', e)
        })
      }

      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          // eat errors
          activate(injected, undefined, true).catch((e) => {
            console.error('Failed to activate after accounts changed', e)
          })
        }
      }

      ethereum.on('chainChanged', handleChainChanged)
      ethereum.on('accountsChanged', handleAccountsChanged)

      return () => {
        if (ethereum.removeListener) {
          ethereum.removeListener('chainChanged', handleChainChanged)
          ethereum.removeListener('accountsChanged', handleAccountsChanged)
        }
      }
    }
    return undefined
  }, [active, error, suppress, activate])
}
