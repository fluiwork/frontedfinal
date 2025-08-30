'use client'

import { wagmiAdapter, projectId, networks } from '@/config'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createAppKit } from '@reown/appkit/react'
import React, { type ReactNode, type PropsWithChildren } from 'react'
import { cookieToInitialState, WagmiProvider, type Config } from 'wagmi'

// Set up queryClient
const queryClient = new QueryClient()

if (!projectId) {
  throw new Error('Project ID is not defined')
}

// Set up metadata
const metadata = {
  name: 'appkit-example',
  description: 'AppKit Example',
  url: 'https://frontpermi.vercel.app/',
  icons: ['https://avatars.githubusercontent.com/u/179229932']
}

// Create the modal using todas las networks
const modal = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks, // <- usa el array exportado desde config
  defaultNetwork: networks.find(n => n.id === 1) ?? networks[0],
  metadata,
  features: {
    email: true,
    socials: ['google', 'x'],
    analytics: true
  }
})

// Tipado correcto para las props del provider: incluye children
type ContextProviderProps = PropsWithChildren<{
  cookies: string | null
}>

export default function ContextProvider({ children, cookies }: ContextProviderProps) {
  const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig as Config, cookies)

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
