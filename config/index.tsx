// config/index.tsx
import { cookieStorage, createStorage } from '@wagmi/core'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { 
  mainnet, 
  arbitrum, 
  base, 
  scroll, 
  polygon, 
  bsc,           // BNB Smart Chain
  optimism,      // Optimism
  avalanche,     // Avalanche
  fantom,        // Fantom
  gnosis,        // Gnosis Chain
  zora,          // Zora Network
  sepolia,       // Ethereum Testnet
  polygonAmoy,   // Polygon Testnet
  baseSepolia,   // Base Testnet
  arbitrumSepolia // Arbitrum Testnet
} from '@reown/appkit/networks'

export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID
if (!projectId) throw new Error('Project ID is not defined')

// Configuración completa de redes principales y testnets
export const networks = [
  // Mainnets
  mainnet,        // Ethereum Mainnet (ID: 1)
  arbitrum,       // Arbitrum One (ID: 42161)
  base,           // Base Mainnet (ID: 8453)
  scroll,         // Scroll Mainnet (ID: 534352)
  polygon,        // Polygon Mainnet (ID: 137)
  bsc,            // BNB Smart Chain (ID: 56) - ¡ESENCIAL!
  optimism,       // Optimism (ID: 10)
  avalanche,      // Avalanche C-Chain (ID: 43114)
  fantom,         // Fantom Opera (ID: 250)
  gnosis,         // Gnosis Chain (ID: 100)
  zora,           // Zora Network (ID: 7777777)
  
  // Testnets
  sepolia,        // Ethereum Sepolia (ID: 11155111)
  polygonAmoy,    // Polygon Amoy (ID: 80002)
  baseSepolia,    // Base Sepolia (ID: 84532)
  arbitrumSepolia // Arbitrum Sepolia (ID: 421614)
]

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: false,
  projectId,
  networks
})

export const wagmiConfig = wagmiAdapter.wagmiConfig