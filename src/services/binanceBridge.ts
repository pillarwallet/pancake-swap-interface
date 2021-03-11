import axios from 'axios';

const BINANCE_BRIDGE_API = 'https://api.binance.org/bridge/api';

const validateResponse = (response) => {
  if (!response?.data?.data) {
    const errorMessage = response?.data?.message;
    throw new Error(errorMessage || 'Unable to get from Binance Bridge API');
  }

  return response.data.data
}

const binanceBridgeService = ({
  getETHAvailableTokens: async () => {
    const response = await axios.get(`${BINANCE_BRIDGE_API}/v2/tokens?walletNetwork=ETH`)

    return validateResponse(response)?.tokens;
  },

  getTokenData: async (tokenSymbol, userAddress) => {
    const [tokens, tokenNetworksResponse, quotasResponse] = await Promise.all([
      binanceBridgeService.getETHAvailableTokens(),
      axios.get(`${BINANCE_BRIDGE_API}/v2/tokens/${tokenSymbol}/networks`),
      axios.get(`${BINANCE_BRIDGE_API}/v1/swaps/quota/24hour?symbol=${tokenSymbol}&walletAddress=${userAddress}`),
    ]);

    const tokenNetworks = tokenNetworksResponse?.data?.data?.networks || [];
    const quota = quotasResponse?.data?.data || {};

    const tokenData = tokens.find(({ symbol }) => symbol === tokenSymbol);
    const networkData = tokenNetworks.find(({ name }) => name === 'ETH');

    const tokenDataMaxAmount = tokenData?.maxAmount ?? 0;
    const maxAmount = Math.min(quota?.left ?? tokenDataMaxAmount, tokenDataMaxAmount);

    return {
      minAmount: tokenData?.minAmount,
      maxAmount,
      bridgeEnabled: networkData?.depositEnabled ?? false,
    };
  },

  registerDepositIntent: async (tokenSymbol, sendAmount, fromAddress, destinationAddress) => {
    const response = await axios.post(`${BINANCE_BRIDGE_API}/v2/swaps`, {
      amount: sendAmount,
      fromNetwork: 'ETH',
      source: 921,
      symbol: tokenSymbol,
      toAddress: destinationAddress,
      toAddressLabel: '',
      toNetwork: 'BSC',
      walletAddress: fromAddress,
      walletNetwork: 'ETH',
    });

    return validateResponse(response);
  },

  getDepositById: async (depositId) => {
    const response = await axios.get(`${BINANCE_BRIDGE_API}/v2/swaps/${depositId}`);

    return validateResponse(response);
  },
})

export default binanceBridgeService
