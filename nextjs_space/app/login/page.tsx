import { isGoogleAuthEnabled } from '@/lib/account-recovery/providers'
import { LoginForm } from './login-form'

// Evaluate the Google gate at request time so runtime credentials are honoured,
// not just the build-time flag.
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return <LoginForm googleEnabled={isGoogleAuthEnabled(process.env)} />
}
