import { useEffect, useState } from 'react'
import { cloudEnabled, supabase } from './lib/supabase.js'

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return undefined
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setMessage(error.message)
      }

      setSession(data?.session ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession)
        setLoading(false)
      },
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function sendMagicLink(event) {
    event.preventDefault()

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setMessage('Indtast din Alfa Laval-emailadresse.')
      return
    }

    setSending(true)
    setMessage('')

    const redirectTo =
      window.location.origin + window.location.pathname

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: false,
      },
    })

    if (error) {
      setMessage(`Loginlinket kunne ikke sendes: ${error.message}`)
    } else {
      setMessage(
        'Hvis emailadressen er godkendt, modtager du nu et loginlink.',
      )
    }

    setSending(false)
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      setMessage(`Du kunne ikke logges ud: ${error.message}`)
    }
  }

  if (!cloudEnabled) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <h1>Konfigurationsfejl</h1>
          <p>Forbindelsen til Supabase er ikke konfigureret.</p>
        </section>
      </main>
    )
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          Kontrollerer login…
        </section>
      </main>
    )
  }

  if (!session) {
    return (
      <main style={styles.page}>
        <form style={styles.card} onSubmit={sendMagicLink}>
          <h1 style={styles.heading}>Workload Board</h1>

          <p style={styles.description}>
            Log ind med den Alfa Laval-emailadresse, der er
            inviteret til dashboardet.
          </p>

          <label htmlFor="login-email" style={styles.label}>
            Email
          </label>

          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="navn@alfalaval.com"
            autoComplete="email"
            required
            style={styles.input}
          />

          <button
            type="submit"
            disabled={sending}
            style={{
              ...styles.primaryButton,
              opacity: sending ? 0.65 : 1,
            }}
          >
            {sending ? 'Sender…' : 'Send loginlink'}
          </button>

          {message && (
            <p role="status" style={styles.message}>
              {message}
            </p>
          )}
        </form>
      </main>
    )
  }

  return (
    <>
      <div style={styles.userBar}>
        <span>Logget ind som {session.user.email}</span>

        <button
          type="button"
          onClick={signOut}
          style={styles.signOutButton}
        >
          Log ud
        </button>
      </div>

      {children}
    </>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: '24px',
    boxSizing: 'border-box',
    background: '#f4f6f8',
    fontFamily: 'Arial, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    padding: '28px',
    boxSizing: 'border-box',
    borderRadius: '12px',
    background: '#ffffff',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
  },
  heading: {
    marginTop: 0,
  },
  description: {
    lineHeight: 1.5,
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontWeight: 600,
  },
  input: {
    boxSizing: 'border-box',
    width: '100%',
    padding: '12px',
    marginBottom: '14px',
    border: '1px solid #b8bec5',
    borderRadius: '6px',
    fontSize: '16px',
  },
  primaryButton: {
    width: '100%',
    padding: '12px',
    border: 0,
    borderRadius: '6px',
    background: '#005eb8',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '16px',
  },
  message: {
    marginBottom: 0,
    marginTop: '16px',
    lineHeight: 1.4,
  },
  userBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 16px',
    background: '#eef1f4',
    fontFamily: 'Arial, sans-serif',
    fontSize: '14px',
  },
  signOutButton: {
    padding: '7px 12px',
    border: '1px solid #777',
    borderRadius: '5px',
    background: '#ffffff',
    cursor: 'pointer',
  },
}