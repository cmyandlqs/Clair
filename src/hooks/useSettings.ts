import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings } from '@/lib/api'
import type { AppSettings } from '@/lib/types'

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Partial<AppSettings>) => updateSettings(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}