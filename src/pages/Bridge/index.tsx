import React, {
  useEffect,
  useState,
} from 'react';
import {
  Button,
  CardBody,
  Text,
  LinkExternal,
} from '@pancakeswap-libs/uikit';
import CardNav from 'components/CardNav';
import { AutoColumn } from 'components/Column';
import {
  Token,
} from '@pancakeswap-libs/sdk';
import styled from 'styled-components';
import { transparentize } from 'polished';
import { AlertTriangle } from 'react-feather';
import { parseUnits } from '@ethersproject/units';
import { useWeb3React } from '@web3-react/core';

import {
  useEtherspotWallet,
} from 'hooks';
import PageHeader from 'components/PageHeader';
import AppBody from '../AppBody';
import { useCurrency } from '../../hooks/Tokens';
import ConnectWalletButton from '../../components/ConnectWalletButton';
import { GreyCard } from '../../components/Card';
import binanceBridgeService from '../../services/binanceBridge';
import { Input as NumericalInput } from '../../components/NumericalInput';
import CurrencyLogo from '../../components/CurrencyLogo';
import {
  getEtherscanLink,
} from '../../utils';

interface BridgeFrom {
  minAmount?: number
  maxAmount?: number
  bridgeEnabled: boolean
}

const BottomGrouping = styled.div`
  margin-top: 1rem;
`

const Container = styled.div`
  border-radius: 16px;
  background-color: ${({ theme }) => theme.colors.input};
  box-shadow: ${({ theme }) => theme.shadows.inset};
`

const InputRow = styled.div`
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 0.75rem 0.75rem 1rem;
`

const Aligner = styled.span`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const CurrencySelect = styled.div`
  align-items: center;
  font-size: 16px;
  font-weight: 500;
  background-color: transparent;
  color: ${({ theme }) => theme.colors.text};
  border-radius: 12px;
  outline: none;
  user-select: none;
  border: none;
  padding: 0 0.5rem;
`

const ErrorInner = styled.div`
  background-color: ${({ theme }) => transparentize(0.9, theme.colors.failure)};
  border-radius: 1rem;
  display: flex;
  align-items: center;
  font-size: 0.825rem;
  width: 100%;
  padding: 1rem 1.25rem 1rem 1rem;
  color: ${({ theme }) => theme.colors.failure};
  z-index: -1;
  p {
    padding: 0;
    margin: 0;
    font-weight: 500;
  }
`

const ErrorInnerAlertTriangle = styled.div`
  background-color: ${({ theme }) => transparentize(0.9, theme.colors.failure)};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  border-radius: 12px;
  min-width: 48px;
  height: 48px;
`

export default function Bridge() {
  const { account } = useEtherspotWallet()

  const { library, account: web3Account, chainId } = useWeb3React()
  const isEthereumMainnetNetwork = chainId === 1

  const [value, setValue] = useState('')
  const [depositInfo, setDepositInfo] = useState(null)
  const [currencyId, setCurrencyId] = useState<string>('ETH')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [bridgeTransactionHash, setBridgeTransactionHash] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [bridgeFrom, setBridgeFrom] = useState<BridgeFrom | null>(null)
  const [availableTokens, setAvailableTokens] = useState<{ [address: string]: Token } | null>(null)

  const currency = useCurrency(currencyId)

  const onQuote = () => {
    setErrorMessage(null)
    setIsLoading(true)
    setDepositInfo(null)
    const tokenSymbol = currency?.symbol === 'BNB' ? 'ETH' : currency?.symbol;
    binanceBridgeService.registerDepositIntent(tokenSymbol, value, web3Account, account)
      .then((data) => {
        // @ts-ignore
        setDepositInfo(data)
        setIsLoading(false)
      })
      .catch((error) => {
        setErrorMessage(error?.message ?? 'Failed to submit')
        setIsLoading(false)
      })
  }

  const onConfirm = async () => {
    setErrorMessage(null)
    // @ts-ignore
    const to = depositInfo.depositAddress
    const from = web3Account
    const valueHex = parseUnits(value, currency?.decimals).toHexString()
    let transactionHash

    if (currencyId !== 'ETH') {
      // const tokenContract = getContract('', ERC20_ABI, library, web3Account ?? undefined)
      // TODO: token bridge?
    } else {
      transactionHash = await library
        .send('eth_sendTransaction', [{
          from,
          to,
          value: valueHex,
        }])
        .catch((error) => {
          setErrorMessage(error?.message ?? 'Failed to send')
          return null
        })
    }

    if (transactionHash) setBridgeTransactionHash(transactionHash)
  }

  const onUserInput = (newValue: string) => {
    setValue(newValue)
  }

  useEffect(() => {
    binanceBridgeService.getETHAvailableTokens()
      .then((data) => {
        // @ts-ignore
        const tokens = data.reduce((tokenMap, token) => {
          const tokenAddress = token?.ethContractAddress
          if (!tokenAddress || tokenMap[tokenAddress]) return tokenMap

          const { name, ethSymbol, ethContractDecimal } = token
          tokenMap[tokenAddress] = new Token(1, tokenAddress, ethContractDecimal, ethSymbol, name)
          return tokenMap
        }, {})

        if (!tokens) return

        setAvailableTokens(tokens)
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    setErrorMessage(null)
    setIsLoading(true)

    const tokenSymbol = currency?.symbol === 'BNB' ? 'ETH' : currency?.symbol;
    binanceBridgeService.getTokenData(tokenSymbol, account)
      .then((data) => {
        setBridgeFrom(data)
        setIsLoading(false)
      })
      .catch((error) => {
        setBridgeFrom({ bridgeEnabled: false })
        setIsLoading(false)
        setErrorMessage(error?.message ?? 'Failed to get token bridge details')
      })
  }, [account, currency])

  let submitWarning;
  if (bridgeFrom !== null && !bridgeFrom?.bridgeEnabled) {
    submitWarning = 'Cannot send'
  } else if (bridgeFrom?.minAmount && Number(value) < bridgeFrom.minAmount) {
    submitWarning = `Min. amount is ${bridgeFrom.minAmount}`
  } else if (bridgeFrom?.maxAmount && Number(value) > bridgeFrom.maxAmount) {
    submitWarning = `Max. amount is ${bridgeFrom.maxAmount}`
  }

  const submitDisabled = bridgeFrom === null || !!submitWarning || isLoading;
  const submitTitle = depositInfo ? 'Confirm' : 'Get quote';

  let totalReceive;
  // @ts-ignore
  if (depositInfo) {
    // @ts-ignore
    totalReceive = Number(value) - (depositInfo.swapFee ?? 0)
  }

  const showBridgeDetails = !errorMessage && !submitWarning && !isLoading && !!totalReceive && !bridgeTransactionHash
  const showSubmit = !!account && !bridgeTransactionHash && !!value

  return (
    <>
      <CardNav activeIndex={2} />
      <AppBody>
        <PageHeader
          title="Bridge"
          description="Send ETH to Binance Smart Chain"
          hideSettings
          hideHistory
        />
        <CardBody>
          {isEthereumMainnetNetwork && (
            <>
              <AutoColumn gap="md">
                <Container>
                  <InputRow>
                    <NumericalInput
                      className="token-amount-input"
                      value={value}
                      onUserInput={onUserInput}
                    />
                    {!!currency && (
                      <CurrencySelect>
                        <Aligner>
                          <CurrencyLogo chainId={1} currency={currency} size="24px" style={{ marginRight: '8px' }} />
                          <Text>ETH</Text>
                        </Aligner>
                      </CurrencySelect>
                    )}
                  </InputRow>
                </Container>
              </AutoColumn>
              <BottomGrouping>
                {!account && <ConnectWalletButton width="100%" />}
                {showBridgeDetails && (
                  <GreyCard style={{ textAlign: 'center' }}>
                    <Text mb="4px">You will receive ~{totalReceive} of ETH BP-20 on Binance Smart Chain</Text>
                  </GreyCard>
                )}
                {!!bridgeTransactionHash && (
                  <>
                    <GreyCard style={{ textAlign: 'center' }}>
                      <Text mb="4px" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        Bridge transaction sent!
                        <LinkExternal href={getEtherscanLink(bridgeTransactionHash, 'transaction')}>
                          View on Etherscan
                        </LinkExternal>
                      </Text>
                    </GreyCard>
                  </>
                )}
                {!!errorMessage && (
                  <ErrorInner>
                    <ErrorInnerAlertTriangle>
                      <AlertTriangle size={24} />
                    </ErrorInnerAlertTriangle>
                    <p>{errorMessage}</p>
                  </ErrorInner>
                )}
                {showSubmit && (
                  <Button
                    onClick={depositInfo ? onConfirm : onQuote}
                    id="bridge-submit-button"
                    disabled={submitDisabled}
                    variant="primary"
                    width="100%"
                    mt="1rem"
                  >
                    {submitWarning || submitTitle}
                  </Button>
                )}
              </BottomGrouping>
            </>
          )}
          {!isEthereumMainnetNetwork && (
            <ErrorInner>
              <ErrorInnerAlertTriangle>
                <AlertTriangle size={24} />
              </ErrorInnerAlertTriangle>
              <p>Must be on Ethereum mainnet!</p>
            </ErrorInner>
          )}
        </CardBody>
      </AppBody>
    </>
  )
}
