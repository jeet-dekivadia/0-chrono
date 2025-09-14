'use client'

import Link from 'next/link'
import { Stethoscope, Mail, CheckCircle } from 'lucide-react'

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2">
            <Stethoscope className="h-10 w-10 text-blue-600" />
            <span className="text-3xl font-bold text-gray-900">0chrono</span>
          </Link>
        </div>

        {/* Verification Message */}
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Check your email
          </h1>
          
          <p className="text-gray-600 mb-6">
            We've sent a verification link to your email address. Please click the link to activate your account and start using 0chrono.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center mb-2">
              <Mail className="h-5 w-5 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-800">Didn't receive the email?</span>
            </div>
            <p className="text-sm text-blue-700">
              Check your spam folder or contact support if you need help.
            </p>
          </div>

          <div className="space-y-3">
            <Link 
              href="/auth/login"
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-block"
            >
              Back to Sign In
            </Link>
            
            <Link 
              href="/"
              className="w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors inline-block"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
