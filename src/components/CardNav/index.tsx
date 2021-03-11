import React from 'react'
import styled from 'styled-components'
import { Link } from 'react-router-dom'
import { ButtonMenu, ButtonMenuItem } from '@pancakeswap-libs/uikit'
import { useWeb3React } from '@web3-react/core';

import TranslatedText from '../TranslatedText'

const StyledNav = styled.div`
  margin-bottom: 40px;
`

const Nav = ({ activeIndex = 0 }: { activeIndex?: number }) => {
  const { chainId } = useWeb3React()
  const isEthereumMainnetNetwork = chainId === 1

  return (
    <StyledNav>
      <ButtonMenu activeIndex={activeIndex} scale="sm" variant="subtle">
        <ButtonMenuItem id="swap-nav-link" to="/swap" as={Link}>
          <TranslatedText translationId={8}>Swap</TranslatedText>
        </ButtonMenuItem>
        <ButtonMenuItem id="pool-nav-link" to="/pool" as={Link}>
          <TranslatedText translationId={74}>Liquidity</TranslatedText>
        </ButtonMenuItem>
        {isEthereumMainnetNetwork ? (
          <ButtonMenuItem id="bridge-nav-link" to="/bridge" as={Link}>
            Bridge
          </ButtonMenuItem>
        ) : (
          <ButtonMenuItem
            id="pool-nav-link"
            as="a"
            href="https://www.binance.org/en/bridge?utm_source=PancakeSwap"
            target="_blank"
            rel="noreferrer noopener"
          >
            Bridge
          </ButtonMenuItem>
        )}
      </ButtonMenu>
    </StyledNav>
  )
}

export default Nav
