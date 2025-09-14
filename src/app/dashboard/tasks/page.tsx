'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  CheckCircle2, 
  Clock, 
  Plus, 
  Search,
  Filter,
  User,
  Calendar,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  FileText,
  Pill,
  Stethoscope,
  Activity
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Task {
  id: string
  type: 'prescription' | 'voice_command' | 'appointment' | 'review' | 'other'
  title: string
  description: string
  status: 'pending' | 'completed' | 'failed'
  patient_name?: string
  created_at: string
  completed_at?: string
  priority: 'low' | 'medium' | 'high'
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const router = useRouter()

  useEffect(() => {
    loadTasks()
  }, [])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadTasks()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadTasks = async () => {
    try {
      setLoading(true)
      
      // Load voice commands as tasks
      const { data: voiceCommands, error: vcError } = await supabase
        .from('voice_commands')
        .select('*')
        .order('created_at', { ascending: false })

      if (vcError) throw vcError

      // Load prescriptions as tasks
      const { data: prescriptions, error: presError } = await supabase
        .from('prescriptions')
        .select('*')
        .order('created_at', { ascending: false })

      if (presError) throw presError

      // Load appointments as tasks
      const { data: appointments, error: aptError } = await supabase
        .from('appointments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      if (aptError) throw aptError

      // Transform data into tasks
      const allTasks: Task[] = []

      // Voice commands as tasks
      voiceCommands?.forEach(vc => {
        allTasks.push({
          id: `vc_${vc.id}`,
          type: 'voice_command',
          title: `Voice Command: ${vc.processed_intent}`,
          description: vc.command_text,
          status: vc.status === 'processed' ? 'completed' : 
                  vc.status === 'failed' ? 'failed' : 'pending',
          created_at: vc.created_at,
          completed_at: vc.processed_at,
          priority: vc.confidence_score > 0.8 ? 'high' : 'medium'
        })
      })

      // Prescriptions as tasks
      prescriptions?.forEach(pres => {
        allTasks.push({
          id: `pres_${pres.id}`,
          type: 'prescription',
          title: `Prescription: ${pres.medication_name}`,
          description: `${pres.dosage} - ${pres.frequency}`,
          status: 'completed',
          patient_name: 'Patient', // Simplified for now
          created_at: pres.created_at,
          completed_at: pres.created_at,
          priority: 'medium'
        })
      })

      // Appointments as tasks
      appointments?.forEach(apt => {
        const isCompleted = apt.status === 'completed'
        allTasks.push({
          id: `apt_${apt.id}`,
          type: 'appointment',
          title: `Appointment: ${apt.appointment_type}`,
          description: `Scheduled for ${new Date(apt.scheduled_date).toLocaleDateString()}`,
          status: isCompleted ? 'completed' : 'pending',
          patient_name: 'Patient', // Simplified for now
          created_at: apt.created_at,
          completed_at: isCompleted ? apt.updated_at : undefined,
          priority: 'medium'
        })
      })

      // Sort by creation date (newest first)
      allTasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setTasks(allTasks)
    } catch (error) {
      console.error('Error loading tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.patient_name?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus
    const matchesType = filterType === 'all' || task.type === filterType
    
    return matchesSearch && matchesStatus && matchesType
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4" />
      case 'pending': return <Clock className="h-4 w-4" />
      case 'failed': return <AlertCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'prescription': return <Pill className="h-5 w-5 text-purple-600" />
      case 'voice_command': return <Activity className="h-5 w-5 text-blue-600" />
      case 'appointment': return <Calendar className="h-5 w-5 text-green-600" />
      case 'review': return <FileText className="h-5 w-5 text-orange-600" />
      default: return <Stethoscope className="h-5 w-5 text-gray-600" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500'
      case 'medium': return 'border-l-yellow-500'
      case 'low': return 'border-l-green-500'
      default: return 'border-l-gray-500'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 1) {
      return 'Just now'
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const completedTasks = filteredTasks.filter(task => task.status === 'completed')
  const pendingTasks = filteredTasks.filter(task => task.status === 'pending')
  const failedTasks = filteredTasks.filter(task => task.status === 'failed')

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
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Tasks & Activities</h1>
                <p className="text-gray-600 mt-1">Track completed and pending medical tasks</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadTasks}
                className="p-2 text-gray-400 hover:text-gray-600"
                title="Refresh"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed Tasks</p>
                <p className="text-3xl font-bold text-green-600">{completedTasks.length}</p>
              </div>
              <div className="bg-green-100 rounded-lg p-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Tasks</p>
                <p className="text-3xl font-bold text-yellow-600">{pendingTasks.length}</p>
              </div>
              <div className="bg-yellow-100 rounded-lg p-3">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Failed Tasks</p>
                <p className="text-3xl font-bold text-red-600">{failedTasks.length}</p>
              </div>
              <div className="bg-red-100 rounded-lg p-3">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search tasks, descriptions, or patients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="voice_command">Voice Commands</option>
                <option value="prescription">Prescriptions</option>
                <option value="appointment">Appointments</option>
                <option value="review">Reviews</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tasks List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              All Tasks ({filteredTasks.length})
            </h3>
          </div>
          
          {filteredTasks.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
              <p className="text-gray-600">No tasks match your current filters.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredTasks.map((task) => (
                <div key={task.id} className={`p-6 hover:bg-gray-50 border-l-4 ${getPriorityColor(task.priority)}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="bg-gray-100 rounded-lg p-3">
                        {getTypeIcon(task.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">
                            {task.title}
                          </h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(task.status)}`}>
                            {getStatusIcon(task.status)}
                            {task.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-2">{task.description}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>Created {formatDate(task.created_at)}</span>
                          {task.patient_name && (
                            <span className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              {task.patient_name}
                            </span>
                          )}
                          {task.completed_at && (
                            <span>Completed {formatDate(task.completed_at)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
