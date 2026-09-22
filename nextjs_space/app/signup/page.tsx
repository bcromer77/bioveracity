import { isGoogleAuthEnabled } from '@/lib/account-recovery/providers'
import { SignupForm } from './signup-form'

// Evaluate the Google gate at request time so runtime credentials are honoured,
// not just the build-time flag.
export const dynamic = 'force-dynamic'

export default function SignupPage() {
  return <SignupForm termsEnabled={process.env.DATA_RIGHTS_ENABLED === 'true'} googleEnabled={isGoogleAuthEnabled(process.env)} />
}
