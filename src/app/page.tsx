'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  Stethoscope, 
  Mic, 
  Calendar, 
  FileText, 
  Shield, 
  Zap, 
  Users, 
  Clock,
  ChevronRight,
  Play,
  Star,
  CheckCircle
} from 'lucide-react'

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Stethoscope className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">0chrono</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <Link href="#features" className="text-gray-600 hover:text-blue-600 transition-colors">Features</Link>
              <Link href="#demo" className="text-gray-600 hover:text-blue-600 transition-colors">Demo</Link>
              <Link href="#pricing" className="text-gray-600 hover:text-blue-600 transition-colors">Pricing</Link>
              <Link href="/auth/login" className="text-gray-600 hover:text-blue-600 transition-colors">Login</Link>
              <Link href="/auth/signup" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6">
              See more patients,
              <br />
              <span className="text-blue-600">not more pages</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Meet Bob, your AI medical assistant that handles administrative tasks through simple voice commands, 
              letting you focus on what matters most - patient care.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/auth/signup" className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2">
                Start Free Trial
                <ChevronRight className="h-5 w-5" />
              </Link>
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="border border-gray-300 text-gray-700 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <Play className="h-5 w-5" />
                Watch Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Voice Demo Section */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-cyan-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-8">
              "Hey Bob, add paracetamol for Jack as he has fever"
            </h2>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-4xl mx-auto">
              <div className="flex items-center justify-center mb-6">
                <div className="bg-white/20 rounded-full p-4">
                  <Mic className="h-12 w-12 text-white" />
                </div>
              </div>
              <p className="text-lg mb-6">
                Bob instantly updates Jack's OPD summary with the prescription. 
                You review and approve with a single click.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div className="bg-white/10 rounded-lg p-4">
                  <Clock className="h-8 w-8 mx-auto mb-2" />
                  <p className="font-semibold">3 seconds</p>
                  <p className="text-sm opacity-90">Voice to action</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                  <p className="font-semibold">95% accuracy</p>
                  <p className="text-sm opacity-90">Medical transcription</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <Shield className="h-8 w-8 mx-auto mb-2" />
                  <p className="font-semibold">HIPAA compliant</p>
                  <p className="text-sm opacity-90">Local processing</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything you need for modern medical practice
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From OPD summaries to insurance claims, Bob handles it all with AI precision
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-8 hover:shadow-lg transition-shadow">
              <div className="bg-blue-600 rounded-lg p-3 w-fit mb-4">
                <Mic className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Voice Commands</h3>
              <p className="text-gray-600">
                Natural voice interface for prescriptions, appointments, and patient updates. 
                Just speak and Bob handles the rest.
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 hover:shadow-lg transition-shadow">
              <div className="bg-green-600 rounded-lg p-3 w-fit mb-4">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Smart Documentation</h3>
              <p className="text-gray-600">
                Automated OPD summaries, patient histories, and medical records. 
                AI-generated, doctor-reviewed.
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 hover:shadow-lg transition-shadow">
              <div className="bg-purple-600 rounded-lg p-3 w-fit mb-4">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Intelligent Scheduling</h3>
              <p className="text-gray-600">
                Automatic appointment scheduling and follow-up reminders. 
                Integrates with your existing calendar.
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-8 hover:shadow-lg transition-shadow">
              <div className="bg-orange-600 rounded-lg p-3 w-fit mb-4">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Emergency Contacts</h3>
              <p className="text-gray-600">
                Instant connection to specialists and anesthesiologists. 
                AI-powered emergency response system.
              </p>
            </div>

            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl p-8 hover:shadow-lg transition-shadow">
              <div className="bg-teal-600 rounded-lg p-3 w-fit mb-4">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Insurance Automation</h3>
              <p className="text-gray-600">
                Automated claim processing and insurance adjudication. 
                Reduce paperwork by 90%.
              </p>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-8 hover:shadow-lg transition-shadow">
              <div className="bg-indigo-600 rounded-lg p-3 w-fit mb-4">
                <Users className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Team Collaboration</h3>
              <p className="text-gray-600">
                Seamless communication between doctors, nurses, and staff. 
                Real-time updates and notifications.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Trusted by medical professionals worldwide
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-600 mb-6">
                "Bob has revolutionized our practice. We see 40% more patients with the same staff. 
                The voice commands are incredibly intuitive."
              </p>
              <div className="flex items-center">
                <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mr-4">
                  <span className="text-blue-600 font-semibold">DR</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Dr. Sarah Chen</p>
                  <p className="text-gray-500">Cardiologist, Metro Hospital</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-600 mb-6">
                "The emergency contact feature saved us critical time during a surgery. 
                Bob connected us with an anesthesiologist in under 30 seconds."
              </p>
              <div className="flex items-center">
                <div className="bg-green-100 rounded-full w-12 h-12 flex items-center justify-center mr-4">
                  <span className="text-green-600 font-semibold">DR</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Dr. Michael Rodriguez</p>
                  <p className="text-gray-500">Surgeon, City Medical Center</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-600 mb-6">
                "Insurance claims that used to take hours now take minutes. 
                Bob's AI accuracy is remarkable - 98% approval rate."
              </p>
              <div className="flex items-center">
                <div className="bg-purple-100 rounded-full w-12 h-12 flex items-center justify-center mr-4">
                  <span className="text-purple-600 font-semibold">DR</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Dr. Emily Johnson</p>
                  <p className="text-gray-500">Family Medicine, Health Plus</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-cyan-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to transform your practice?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of medical professionals who trust 0chrono to streamline their workflow
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup" className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors">
              Start Free Trial
            </Link>
            <Link href="/demo" className="border-2 border-white text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors">
              Schedule Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Stethoscope className="h-8 w-8 text-blue-400" />
                <span className="text-2xl font-bold">0chrono</span>
              </div>
              <p className="text-gray-400 mb-4">
                See more patients, not more pages.
              </p>
              <p className="text-gray-400 text-sm">
                © 2024 0chrono. All rights reserved.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/demo" className="hover:text-white transition-colors">Demo</Link></li>
                <li><Link href="/integrations" className="hover:text-white transition-colors">Integrations</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link href="/careers" className="hover:text-white transition-colors">Careers</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/help" className="hover:text-white transition-colors">Help Center</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="/security" className="hover:text-white transition-colors">Security</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
