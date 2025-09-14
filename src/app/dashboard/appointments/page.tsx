'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Calendar, 
  Clock, 
  Plus, 
  Search,
  Filter,
  User,
  MapPin,
  Phone,
  Mail,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Edit,
  Trash2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Appointment {
  id: string
  patient_id: string
  doctor_id: string
  appointment_type: string
  scheduled_date: string
  duration_minutes: number
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  chief_complaint?: string
  notes?: string
  room_number?: string
  patient_name?: string
  patient_phone?: string
  created_at: string
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterDate, setFilterDate] = useState<string>('today')
  const router = useRouter()

  useEffect(() => {
    loadAppointments()
  }, [])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadAppointments()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadAppointments = async () => {
    try {
      setLoading(true)
      
      // Get date range based on filter
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      let query = supabase
        .from('appointments')
        .select('*')
        .order('scheduled_date', { ascending: true })

      if (filterDate === 'today') {
        query = query
          .gte('scheduled_date', today.toISOString().split('T')[0])
          .lt('scheduled_date', tomorrow.toISOString().split('T')[0])
      } else if (filterDate === 'week') {
        const weekFromNow = new Date(today)
        weekFromNow.setDate(weekFromNow.getDate() + 7)
        query = query
          .gte('scheduled_date', today.toISOString().split('T')[0])
          .lt('scheduled_date', weekFromNow.toISOString().split('T')[0])
      }

      const { data, error } = await query

      if (error) throw error

      // Transform data without patient join
      const transformedAppointments = data?.map(apt => ({
        id: apt.id,
        patient_id: apt.patient_id,
        doctor_id: apt.doctor_id,
        appointment_type: apt.appointment_type,
        scheduled_date: apt.scheduled_date,
        duration_minutes: apt.duration_minutes,
        status: apt.status,
        chief_complaint: apt.chief_complaint,
        notes: apt.notes,
        room_number: apt.room_number,
        patient_name: 'Patient', // Simplified for now
        patient_phone: '',
        created_at: apt.created_at
      })) || []

      setAppointments(transformedAppointments)
    } catch (error) {
      console.error('Error loading appointments:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredAppointments = appointments.filter(appointment => {
    const matchesSearch = appointment.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         appointment.appointment_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         appointment.chief_complaint?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesFilter = filterStatus === 'all' || appointment.status === filterStatus
    
    return matchesSearch && matchesFilter
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      case 'no_show': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Clock className="h-4 w-4" />
      case 'completed': return <CheckCircle2 className="h-4 w-4" />
      case 'cancelled': return <AlertCircle className="h-4 w-4" />
      case 'no_show': return <AlertCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }

  const updateAppointmentStatus = async (appointmentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId)

      if (error) throw error
      
      // Refresh appointments
      loadAppointments()
    } catch (error) {
      console.error('Error updating appointment:', error)
    }
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
                <h1 className="text-3xl font-bold text-gray-900">Appointments</h1>
                <p className="text-gray-600 mt-1">Manage your appointment schedule</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadAppointments}
                className="p-2 text-gray-400 hover:text-gray-600"
                title="Refresh"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Schedule Appointment
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search appointments, patients, or conditions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <select
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="all">All Time</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
            </div>
          </div>
        </div>

        {/* Appointments List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Appointments ({filteredAppointments.length})
            </h3>
          </div>
          
          {filteredAppointments.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No appointments found</h3>
              <p className="text-gray-600">No appointments match your current filters.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredAppointments.map((appointment) => {
                const { date, time } = formatDate(appointment.scheduled_date)
                return (
                  <div key={appointment.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start space-x-4">
                        <div className="bg-blue-100 rounded-lg p-3">
                          <Calendar className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-semibold text-gray-900">
                              {appointment.patient_name}
                            </h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(appointment.status)}`}>
                              {getStatusIcon(appointment.status)}
                              {appointment.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span>{date} at {time}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span>{appointment.appointment_type}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              <span>{appointment.room_number || 'Room TBD'}</span>
                            </div>
                          </div>
                          {appointment.chief_complaint && (
                            <div className="mt-2 text-sm text-gray-700">
                              <strong>Chief Complaint:</strong> {appointment.chief_complaint}
                            </div>
                          )}
                          {appointment.notes && (
                            <div className="mt-1 text-sm text-gray-600">
                              <strong>Notes:</strong> {appointment.notes}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {appointment.status === 'scheduled' && (
                          <>
                            <button
                              onClick={() => updateAppointmentStatus(appointment.id, 'completed')}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                              title="Mark as completed"
                            >
                              <CheckCircle2 className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => updateAppointmentStatus(appointment.id, 'cancelled')}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Cancel appointment"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </>
                        )}
                        <button className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg">
                          <Edit className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
