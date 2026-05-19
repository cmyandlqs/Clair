import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  generateWrapper,
  checkWrapperStatus,
  testProfile,
  reloadProxyConfig,
} from '@/lib/api'
import type { CreateProfileInput, UpdateProfileInput } from '@/lib/api'

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
  })
}

export function useCreateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateProfileInput) => createProfile(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      reloadProxyConfig().catch(() => {})
    },
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...input }: UpdateProfileInput & { id: string }) =>
      updateProfile({ id, ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      reloadProxyConfig().catch(() => {})
    },
  })
}

export function useDeleteProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      reloadProxyConfig().catch(() => {})
    },
  })
}

export function useGenerateWrapper() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (profileId: string) => generateWrapper(profileId),
    onSuccess: (_, profileId) => {
      queryClient.invalidateQueries({ queryKey: ['wrapperStatus', profileId] })
    },
  })
}

export function useWrapperStatus(profileId?: string) {
  return useQuery({
    queryKey: ['wrapperStatus', profileId],
    queryFn: () => checkWrapperStatus(profileId!),
    enabled: Boolean(profileId),
    refetchInterval: 5000,
  })
}

export function useTestProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (profileId: string) => testProfile(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxyEvidence'] })
    },
  })
}
