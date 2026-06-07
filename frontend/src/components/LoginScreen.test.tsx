import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginScreen } from './LoginScreen'

function makeProps(overrides: Partial<Parameters<typeof LoginScreen>[0]> = {}) {
  return {
    email: '',
    password: '',
    signupEmail: '',
    signupPassword: '',
    signupUsername: '',
    signupInviteCode: '',
    verificationToken: '',
    message: '',
    onEmailChange: vi.fn(),
    onPasswordChange: vi.fn(),
    onSignupEmailChange: vi.fn(),
    onSignupPasswordChange: vi.fn(),
    onSignupUsernameChange: vi.fn(),
    onSignupInviteCodeChange: vi.fn(),
    onVerificationTokenChange: vi.fn(),
    onLogin: vi.fn(e => e.preventDefault()),
    onRegister: vi.fn(e => e.preventDefault()),
    onVerifyEmail: vi.fn(e => e.preventDefault()),
    ...overrides,
  }
}

describe('LoginScreen', () => {
  it('rend les champs email et mot de passe', () => {
    render(<LoginScreen {...makeProps()} />)
    expect(screen.getAllByLabelText(/email/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/mot de passe/i).length).toBeGreaterThan(0)
  })

  it('appelle onEmailChange à la saisie', async () => {
    const onEmailChange = vi.fn()
    const user = userEvent.setup()
    render(<LoginScreen {...makeProps({ onEmailChange })} />)
    const emailInputs = screen.getAllByLabelText(/email/i) as HTMLInputElement[]
    await user.type(emailInputs[0], 'a')
    expect(onEmailChange).toHaveBeenCalledWith('a')
  })

  it('affiche le message global s\'il est fourni', () => {
    render(<LoginScreen {...makeProps({ message: 'Identifiants invalides' })} />)
    expect(screen.getByText('Identifiants invalides')).toBeInTheDocument()
  })
})
