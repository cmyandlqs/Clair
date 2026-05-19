import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getProxyStatus,
    getProxyEvidence,
  startProxy,
  stopProxy,
} from '@/lib/api'

export function useProxyStatus() {
  return useQuery({
    queryKey: ['proxyStatus'],
    queryFn: getProxyStatus,
    refetchInterval: 5000,
  })
}

export function useProxyEvidence(limit = 20) {
  return useQuery({
    queryKey: ['proxyEvidence', limit],
    queryFn: () => getProxyEvidence(limit),
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
