'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Stethoscope, Mail, User } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!email) {
      setError('Please enter your email')
      setLoading(false)
      return
    }

    try {
      // For login, we'll get the name from existing users or use a default
      const userData = {
        email,
        name: email.split('@')[0], // Use email prefix as name for simplicity
        loginTime: new Date().toISOString()
      }
      localStorage.setItem('user', JSON.stringify(userData))
      
      // Redirect to dashboard
      router.push('/dashboard')
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2">
            <Stethoscope className="h-10 w-10 text-blue-600" />
            <span className="text-3xl font-bold text-black">0chrono</span>
          </Link>
          <p className="text-gray-800 mt-2 font-medium">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-black mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-black placeholder-gray-500"
                  placeholder="doctor@hospital.com"
                />
              </div>
            </div>


            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Entering Dashboard...' : 'Enter Dashboard'}
            </button>
          </form>

          {/* Info */}
          <div className="mt-6 text-center">
            <p className="text-gray-800 text-sm font-medium">
              Just enter your email and name to access your personalized dashboard
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
