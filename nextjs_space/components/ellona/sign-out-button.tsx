'use client'

import { signOut } from 'next-auth/react'
import { useState } from 'react'

export function SignOutButton() {
  const [error,setError] = useState('')
  return (
    <>
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        signOut({ redirect: false }).then(() => window.location.assign('/')).catch(() => setError('Sign out could not be confirmed. Please try again.'))
      }}
    >
      Sign out
    </button>
    {error && <p role="alert">{error}</p>}
    </>
  )
}
