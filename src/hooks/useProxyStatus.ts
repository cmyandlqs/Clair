import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getProxyStatus,
  startProxy,
  stopProxy,
  restartProxy,
} from '@/lib/api'

export function useProxyStatus() {
  return useQuery({
    queryKey: ['proxyStatus'],
    queryFn: getProxyStatus,
    refetchInterval: 5000,
  })
}

export function useStartProxy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => startProxy(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxyStatus'] })
    },
  })
}

export function useStopProxy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => stopProxy(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxyStatus'] })
    },
  })
}

export function useRestartProxy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => restartProxy(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxyStatus'] })
    },
  })
}