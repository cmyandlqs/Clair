import { z } from 'zod'

export const providerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  type: z.enum(['anthropic_compatible', 'openai_compatible', 'custom']),
  baseUrl: z.string().min(1, 'Base URL is required').refine(
    (val: string) => {
      // Allow URLs with or without protocol
      // If no protocol, must have at least one dot (domain-like) or be localhost
      if (!val.includes('://')) {
        return val.includes('.') || val.includes('localhost')
      }
      // If has protocol, it must be http or https
      try {
        const url = new URL(val)
        return url.protocol === 'http:' || url.protocol === 'https:'
      } catch {
        return false
      }
    },
    { message: 'Invalid URL format. Use https://api.example.com or api.example.com' }
  ),
  apiKey: z.string().min(1, 'API Key is required'),
  authScheme: z.enum(['x_api_key', 'bearer']),
  defaultModel: z.string().min(1, 'Default model is required'),
  enableStreaming: z.boolean().default(true),
  notes: z.string().max(500).optional(),
})

export const updateProviderSchema = providerSchema.partial()

export type ProviderFormData = z.infer<typeof providerSchema>

export const RESERVED_ROUTES = ['/health', '/status', '/api', '/admin', '/logs']

export const DANGEROUS_COMMANDS = [
  'bash', 'sh', 'sudo', 'rm', 'cp', 'mv', 'python', 'node', 'npm',
  'git', 'docker', 'kubectl', 'aws', 'gcloud', 'cargo', 'go', 'java'
]

export const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  routePath: z.string()
    .min(1, 'Route path is required')
    .regex(/^\/[a-z0-9_-]+$/, 'Route must start with / and contain only lowercase letters, numbers, - and _')
    .refine(path => !RESERVED_ROUTES.includes(path), {
      message: 'This route path is reserved'
    }),
  providerId: z.string().min(1, 'Please select a provider'),
  model: z.string().min(1, 'Model is required'),
  commandName: z.string()
    .min(1, 'Command name is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Command name can only contain letters, numbers, - and _')
    .refine(cmd => !DANGEROUS_COMMANDS.includes(cmd.toLowerCase()), {
      message: 'This command name is not allowed'
    }),
  isDefault: z.boolean().default(false),
  wrapperEnabled: z.boolean().default(true),
})

export const updateProfileSchema = profileSchema.partial()

export type ProfileFormData = z.infer<typeof profileSchema>