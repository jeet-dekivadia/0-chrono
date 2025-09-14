'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Stethoscope, 
  Mic, 
  MicOff,
  Calendar, 
  FileText, 
  Users, 
  Bell,
  Search,
  Plus,
  Clock,
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  User,
  LogOut
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { CerebrasClient } from '@/lib/cerebras'

interface DashboardStats {
  todayAppointments: number
  pendingReviews: number
  activePatients: number
  completedTasks: number
}

interface RecentActivity {
  id: string
  type: 'appointment' | 'prescription' | 'voice_command' | 'insurance'
  description: string
  time: string
  status: 'completed' | 'pending' | 'review'
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [latestTranscript, setLatestTranscript] = useState('Waiting for voice commands...')
  const [transcriptError, setTranscriptError] = useState('')
  const [lastProcessedTranscript, setLastProcessedTranscript] = useState('')
  const [stats, setStats] = useState<DashboardStats>({
    todayAppointments: 0,
    pendingReviews: 0,
    activePatients: 0,
    completedTasks: 0
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [todaySchedule, setTodaySchedule] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkUser()
    loadDashboardData()

    // Set up real-time refresh every 30 seconds
    const interval = setInterval(() => {
      loadDashboardData()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const checkUser = async () => {
    // Check localStorage for simple auth
    const userData = localStorage.getItem('user')
    if (!userData) {
      router.push('/auth/login')
      return
    }

    try {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
    } catch (error) {
      router.push('/auth/login')
    }
  }

  const loadDashboardData = useCallback(async () => {
    try {
      // Load real data from Supabase with parallel queries for better performance
      const today = new Date().toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      
      const [
        appointmentsResult,
        pendingCommandsResult,
        patientsResult,
        completedCommandsResult,
        recentCommandsResult,
        todayAppointmentsResult
      ] = await Promise.all([
        // Today's appointments count
        supabase
          .from('appointments')
          .select('id')
          .gte('scheduled_date', today)
          .lt('scheduled_date', tomorrow),
        
        // Pending reviews (voice commands requiring review)
        supabase
          .from('voice_commands')
          .select('id')
          .eq('status', 'requires_review'),
        
        // Active patients count
        supabase
          .from('patients')
          .select('id'),
        
        // Completed tasks (voice commands processed today)
        supabase
          .from('voice_commands')
          .select('id')
          .eq('status', 'executed')
          .gte('created_at', today),
        
        // Recent voice commands for activity
        supabase
          .from('voice_commands')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10),
        
        // Today's scheduled appointments with details
        supabase
          .from('appointments')
          .select(`
            id,
            appointment_type,
            scheduled_date,
            patients (first_name, last_name)
          `)
          .gte('scheduled_date', today)
          .lt('scheduled_date', tomorrow)
          .order('scheduled_date', { ascending: true })
          .limit(5)
      ])

      setStats({
        todayAppointments: appointmentsResult.data?.length || 0,
        pendingReviews: pendingCommandsResult.data?.length || 0,
        activePatients: patientsResult.data?.length || 0,
        completedTasks: completedCommandsResult.data?.length || 0
      })

      // Process recent commands for activity feed
      if (recentCommandsResult.data) {
        const activities: RecentActivity[] = recentCommandsResult.data.map(command => ({
          id: command.id,
          type: 'voice_command',
          description: command.action_taken || `Processed: "${command.command_text}"`,
          time: formatTimeAgo(command.created_at),
          status: command.status === 'executed' ? 'completed' : 
                  command.status === 'requires_review' ? 'review' : 'pending'
        }))
        setRecentActivity(activities)
      }

      // Store today's appointments for schedule preview
      if (todayAppointmentsResult.data) {
        setTodaySchedule(todayAppointmentsResult.data)
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error)
      // Fallback to demo data
      setStats({
        todayAppointments: 12,
        pendingReviews: 5,
        activePatients: 89,
        completedTasks: 23
      })

      setRecentActivity([
        {
          id: '1',
          type: 'voice_command',
          description: 'Added paracetamol prescription for Jack Smith',
          time: '2 minutes ago',
          status: 'completed'
        },
        {
          id: '2',
          type: 'appointment',
          description: 'Completed consultation with Sarah Johnson',
          time: '15 minutes ago',
          status: 'completed'
        },
        {
          id: '3',
          type: 'prescription',
          description: 'Prescription review needed for Mike Davis',
          time: '30 minutes ago',
          status: 'review'
        }
      ])
    } finally {
      setLoading(false)
    }
  }, [])

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`
    return `${Math.floor(diffInMinutes / 1440)} days ago`
  }

  // Fetch transcripts from external API
  const fetchTranscripts = async () => {
    setTranscriptError('')
    try {
      const res = await fetch('https://shaved-delayed-physician-magazine.trycloudflare.com/transcripts', { 
        mode: 'cors', 
        cache: 'no-store' 
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const ct = res.headers.get('content-type') || ''
      if (!ct.includes('application/json')) {
        const head = (await res.text()).slice(0, 120)
        throw new Error(`Expected JSON, got "${ct}". First chars: ${head}`)
      }
      const data = await res.json()
      const newTranscript = data[0]?.transcript ?? '(none)'
      
      // Only process if we have a new transcript that's different from the last one
      if (newTranscript && newTranscript !== '(none)' && newTranscript !== lastProcessedTranscript) {
        setLatestTranscript(newTranscript)
        setLastProcessedTranscript(newTranscript)
        await processVoiceCommand(newTranscript)
      } else if (newTranscript === '(none)') {
        setLatestTranscript('No voice commands detected')
      }
    } catch (e) {
      setTranscriptError(String(e))
      console.error('Transcript fetch error:', e)
    }
  }

  // Poll for transcripts every 4 seconds
  useEffect(() => {
    let alive = true
    
    const pollTranscripts = () => {
      if (alive) fetchTranscripts()
    }
    
    // Initial fetch
    pollTranscripts()
    
    // Set up polling interval
    const intervalId = setInterval(pollTranscripts, 4000)
    
    return () => {
      alive = false
      clearInterval(intervalId)
    }
  }, [lastProcessedTranscript])

  const processVoiceCommand = async (command: string) => {
    try {
      const cerebras = new CerebrasClient()
      const response = await cerebras.processVoiceCommand({
        text: command,
        context: {
          doctorId: user?.email || 'demo-user',
          patientId: undefined // Would be set based on current context
        }
      })

      // Handle the AI response
      console.log('Bob processed command:', response)
      
      // Save voice command to database
      try {
        // First get or create the doctor's profile
        let doctorId = null
        
        const { data: doctorProfile, error: doctorError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', user?.email || 'demo-user')
          .single()

        if (doctorProfile) {
          doctorId = doctorProfile.id
        } else {
          // Create user profile if it doesn't exist
          const { data: newProfile, error: createError } = await supabase
            .from('user_profiles')
            .insert({
              email: user?.email || 'demo-user',
              full_name: user?.name || 'Demo User',
              role: 'doctor'
            })
            .select()
            .single()

          if (newProfile) {
            doctorId = newProfile.id
            console.log('Created new user profile:', newProfile)
          } else {
            console.error('Error creating user profile:', createError)
          }
        }

        const { data: insertData, error: insertError } = await supabase
          .from('voice_commands')
          .insert({
            doctor_id: doctorId,
            command_text: command,
            processed_intent: response.intent,
            action_taken: response.action,
            confidence_score: response.confidence,
            status: 'requires_review',
            metadata: response.parameters
          })
          .select()

        if (insertError) {
          console.error('Error inserting voice command:', insertError)
          alert('Failed to save voice command. Please try again.')
        } else {
          console.log('Voice command saved successfully:', insertData)
          // Show success message
          setLatestTranscript(`✅ Command processed: "${command}"`)
          // Refresh dashboard data to show new pending review
          setTimeout(() => {
            loadDashboardData()
          }, 500)
        }
      } catch (dbError) {
        console.error('Error saving voice command:', dbError)
      }
      
      // Add to recent activity
      const newActivity: RecentActivity = {
        id: Date.now().toString(),
        type: 'voice_command',
        description: `Bob: ${response.action}`,
        time: 'Just now',
        status: 'review'
      }

      setRecentActivity(prev => [newActivity, ...prev.slice(0, 9)])
    } catch (error) {
      console.error('Error processing voice command:', error)
    }
  }

  const handleLogout = async () => {
    localStorage.removeItem('user')
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <Stethoscope className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">0chrono</span>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-lg mx-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search patients, appointments, records..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <button className="relative p-2 text-gray-400 hover:text-gray-600">
                <Bell className="h-6 w-6" />
                <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
              </button>
              
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 rounded-full w-8 h-8 flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500">Doctor</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Good morning, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-gray-600 mt-1">
            You have {stats.todayAppointments} appointments today and {stats.pendingReviews} items need your review.
          </p>
        </div>

        {/* Bob Voice Assistant */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-6 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Bob AI - Voice Command Monitor</h2>
              <p className="text-blue-100">
                Automatically processing voice commands from external API
              </p>
              <div className="mt-3 bg-white/10 rounded-lg p-3">
                <p className="text-sm">Latest: {latestTranscript}</p>
                {transcriptError && (
                  <p className="text-xs text-red-200 mt-1">Error: {transcriptError}</p>
                )}
              </div>
            </div>
            <div className="rounded-full p-4 bg-white/20">
              <Mic className="h-8 w-8 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <button 
            onClick={() => router.push('/dashboard/appointments')}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-left w-full"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Appointments</p>
                <p className="text-3xl font-bold text-gray-900">{stats.todayAppointments}</p>
              </div>
              <div className="bg-blue-100 rounded-lg p-3">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-600">Click to manage</span>
            </div>
          </button>

          <button 
            onClick={() => router.push('/dashboard/reviews')}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-left w-full"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Reviews</p>
                <p className="text-3xl font-bold text-gray-900">{stats.pendingReviews}</p>
              </div>
              <div className="bg-orange-100 rounded-lg p-3">
                <AlertCircle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <Clock className="h-4 w-4 text-orange-500 mr-1" />
              <span className="text-orange-600">Click to review</span>
            </div>
          </button>

          <button 
            onClick={() => router.push('/dashboard/patients')}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-left w-full"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Patients</p>
                <p className="text-3xl font-bold text-gray-900">{stats.activePatients}</p>
              </div>
              <div className="bg-green-100 rounded-lg p-3">
                <Users className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <Activity className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-600">Click to manage</span>
            </div>
          </button>

          <button 
            onClick={() => router.push('/dashboard/tasks')}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-left w-full"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed Tasks</p>
                <p className="text-3xl font-bold text-gray-900">{stats.completedTasks}</p>
              </div>
              <div className="bg-purple-100 rounded-lg p-3">
                <CheckCircle2 className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-600">Click to view</span>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                  <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    View All
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start space-x-3">
                      <div className={`rounded-full p-2 ${
                        activity.type === 'voice_command' ? 'bg-blue-100' :
                        activity.type === 'appointment' ? 'bg-green-100' :
                        activity.type === 'prescription' ? 'bg-purple-100' :
                        'bg-orange-100'
                      }`}>
                        {activity.type === 'voice_command' && <Mic className="h-4 w-4 text-blue-600" />}
                        {activity.type === 'appointment' && <Calendar className="h-4 w-4 text-green-600" />}
                        {activity.type === 'prescription' && <FileText className="h-4 w-4 text-purple-600" />}
                        {activity.type === 'insurance' && <Activity className="h-4 w-4 text-orange-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{activity.description}</p>
                        <p className="text-xs text-gray-500">{activity.time}</p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        activity.status === 'completed' ? 'bg-green-100 text-green-800' :
                        activity.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {activity.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full flex items-center space-x-3 p-3 text-left rounded-lg hover:bg-gray-50 transition-colors">
                  <Plus className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900">New Patient</span>
                </button>
                <button className="w-full flex items-center space-x-3 p-3 text-left rounded-lg hover:bg-gray-50 transition-colors">
                  <Calendar className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-900">Schedule Appointment</span>
                </button>
                <button className="w-full flex items-center space-x-3 p-3 text-left rounded-lg hover:bg-gray-50 transition-colors">
                  <FileText className="h-5 w-5 text-purple-600" />
                  <span className="text-sm font-medium text-gray-900">Create Prescription</span>
                </button>
                <button 
                  onClick={() => router.push('/dashboard/patients')}
                  className="w-full flex items-center space-x-3 p-3 text-left rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Users className="h-5 w-5 text-orange-600" />
                  <span className="text-sm font-medium text-gray-900">Patient Records</span>
                </button>
              </div>
            </div>

            {/* Voice Commands API Monitor */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Voice Commands</h3>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-500">API Listening</span>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <Mic className="h-4 w-4 text-blue-600 animate-pulse" />
                    <span className="text-sm font-medium text-blue-900">Live Transcript Monitor</span>
                  </div>
                  <p className="text-sm text-gray-700">{latestTranscript}</p>
                </div>
                
                {transcriptError && (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-600">API Error: {transcriptError}</p>
                  </div>
                )}
                
                <div className="text-xs text-gray-500">
                  🎤 Voice commands are automatically detected and processed from the external API every 4 seconds
                </div>
              </div>
            </div>

            {/* Today's Schedule Preview */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Today&apos;s Schedule</h3>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-500">Live</span>
                </div>
              </div>
              <div className="space-y-3">
                {todaySchedule.length > 0 ? (
                  todaySchedule.map((appointment, index) => {
                    const colors = ['blue', 'green', 'purple', 'orange', 'pink']
                    const color = colors[index % colors.length]
                    const time = new Date(appointment.scheduled_date).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })
                    
                    return (
                      <div key={appointment.id} className={`flex items-center justify-between p-3 bg-${color}-50 rounded-lg`}>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {appointment.patients?.first_name} {appointment.patients?.last_name}
                          </p>
                          <p className="text-xs text-gray-500">{appointment.appointment_type}</p>
                        </div>
                        <span className={`text-xs font-medium text-${color}-600`}>{time}</span>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-4">
                    <Calendar className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">No appointments scheduled for today</p>
                  </div>
                )}
              </div>
              
              {/* Visualize All Patients Button */}
              <div className="mt-6">
                <button
                  onClick={() => router.push('/dashboard/visualization')}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 flex items-center justify-center gap-3 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Visualize All Patients
                  <span className="text-sm opacity-90">Interactive Network View</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
