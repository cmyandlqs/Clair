import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  testProvider,
  reloadProxyConfig,
} from '@/lib/api'
import type { CreateProviderInput, UpdateProviderInput } from '@/lib/api'

export function useProviders() {
  return useQuery({
    queryKey: ['providers'],
    queryFn: listProviders,
  })
}

export function useCreateProvider() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateProviderInput) => createProvider(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] })
      reloadProxyConfig().catch(() => {})
    },
  })
}

export function useUpdateProvider() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...input }: UpdateProviderInput & { id: string }) =>
      updateProvider({ id, ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] })
      reloadProxyConfig().catch(() => {})
    },
  })
}

export function useDeleteProvider() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteProvider(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] })
      reloadProxyConfig().catch(() => {})
    },
  })
}

export function useTestProvider() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => testProvider(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] })
    },
  })
}
