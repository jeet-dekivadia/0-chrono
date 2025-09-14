'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Check, 
  X, 
  Clock, 
  Mic, 
  User, 
  Calendar,
  FileText,
  AlertCircle,
  ChevronLeft,
  RefreshCw,
  Filter
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface VoiceCommand {
  id: string
  doctor_id: string
  command_text: string
  processed_intent: string
  action_taken: string
  confidence_score: number
  status: 'requires_review' | 'processed' | 'failed' | 'executed'
  metadata: any
  created_at: string
  patient_context?: string
}

interface Patient {
  id: string
  patient_id: string
  emergency_contact_name: string
  medical_history: string
}

export default function ReviewsPage() {
  const [user, setUser] = useState<any>(null)
  const [voiceCommands, setVoiceCommands] = useState<VoiceCommand[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'requires_review' | 'processed' | 'failed'>('requires_review')
  const router = useRouter()

  useEffect(() => {
    checkUser()
    loadData()
  }, [filter])

  const checkUser = () => {
    const userData = localStorage.getItem('user')
    if (!userData) {
      router.push('/auth/login')
      return
    }
    setUser(JSON.parse(userData))
  }

  const loadData = async () => {
    try {
      setLoading(true)

      // Load voice commands based on filter
      let query = supabase
        .from('voice_commands')
        .select('*')
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data: commands, error: commandsError } = await query

      if (commandsError) {
        console.error('Error loading voice commands:', commandsError)
      } else {
        setVoiceCommands(commands || [])
      }

      // Load patients for context
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('id, patient_id, emergency_contact_name, medical_history')

      if (patientsError) {
        console.error('Error loading patients:', patientsError)
      } else {
        setPatients(patientsData || [])
      }

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async (commandId: string, approved: boolean) => {
    setProcessingId(commandId)
    
    try {
      const command = voiceCommands.find(cmd => cmd.id === commandId)
      if (!command) return

      // Update command status
      const newStatus = approved ? 'processed' : 'failed'
      const { error: updateError } = await supabase
        .from('voice_commands')
        .update({ 
          status: newStatus,
          processed_at: new Date().toISOString()
        })
        .eq('id', commandId)

      if (updateError) {
        console.error('Error updating command status:', updateError)
        return
      }

      // If approved, execute the action
      if (approved) {
        await executeApprovedCommand(command)
      }

      // Refresh the list
      await loadData()

    } catch (error) {
      console.error('Error processing approval:', error)
    } finally {
      setProcessingId(null)
    }
  }

  const executeApprovedCommand = async (command: VoiceCommand) => {
    try {
      // Parse the intent and execute appropriate action
      switch (command.processed_intent) {
        case 'add_prescription':
          await addPrescriptionFromCommand(command)
          break
        case 'schedule_appointment':
          await scheduleAppointmentFromCommand(command)
          break
        case 'update_patient_record':
          await updatePatientRecordFromCommand(command)
          break
        default:
          console.log('No specific action defined for intent:', command.processed_intent)
      }

      // Update command status to executed
      await supabase
        .from('voice_commands')
        .update({ status: 'executed' })
        .eq('id', command.id)

    } catch (error) {
      console.error('Error executing approved command:', error)
    }
  }

  const addPrescriptionFromCommand = async (command: VoiceCommand) => {
    try {
      // Extract prescription details from metadata
      const metadata = command.metadata || {}
      const patientName = metadata.patient || 'Unknown Patient'
      const medication = metadata.medication || 'Medication from voice command'
      
      // Find patient by ID or name (simplified matching)
      const patient = patients.find(p => 
        p.patient_id.toLowerCase().includes(patientName.toLowerCase()) ||
        p.emergency_contact_name.toLowerCase().includes(patientName.toLowerCase())
      )

      // Insert prescription
      const { error } = await supabase
        .from('prescriptions')
        .insert({
          patient_id: patient?.id || null,
          doctor_id: command.doctor_id,
          medication_name: medication,
          dosage: metadata.dosage || '1 tablet',
          frequency: metadata.frequency || 'Once daily',
          duration: metadata.duration || '7 days',
          instructions: `Added via voice command: "${command.command_text}"`,
          status: 'active',
          prescribed_date: new Date().toISOString()
        })

      if (error) {
        console.error('Error adding prescription:', error)
      } else {
        console.log('Prescription added successfully')
      }
    } catch (error) {
      console.error('Error in addPrescriptionFromCommand:', error)
    }
  }

  const scheduleAppointmentFromCommand = async (command: VoiceCommand) => {
    try {
      const metadata = command.metadata || {}
      const patientName = metadata.patient || 'Unknown Patient'
      
      const patient = patients.find(p => 
        p.patient_id.toLowerCase().includes(patientName.toLowerCase()) ||
        p.emergency_contact_name.toLowerCase().includes(patientName.toLowerCase())
      )

      // Create a proper future date for the appointment
      let appointmentDate
      if (metadata.date) {
        const parsedDate = new Date(metadata.date)
        if (!isNaN(parsedDate.getTime())) {
          appointmentDate = parsedDate.toISOString()
        } else {
          console.warn('Invalid date in metadata:', metadata.date)
          appointmentDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      } else {
        appointmentDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Default to 1 week from now
      }

      // Insert appointment with better error handling
      const { data: appointmentData, error } = await supabase
        .from('appointments')
        .insert({
          patient_id: patient?.id || null,
          doctor_id: command.doctor_id,
          appointment_type: metadata.type || 'Follow-up',
          scheduled_date: appointmentDate,
          duration_minutes: parseInt(metadata.duration) || 30,
          status: 'scheduled',
          notes: `Scheduled via voice command: "${command.command_text}"`
        })
        .select()

      if (error) {
        console.error('Error scheduling appointment:', error)
        console.error('Command data:', command)
        console.error('Patient data:', patient)
      } else {
        console.log('Appointment scheduled successfully:', appointmentData)
      }
    } catch (error) {
      console.error('Error in scheduleAppointmentFromCommand:', error)
    }
  }

  const updatePatientRecordFromCommand = async (command: VoiceCommand) => {
    try {
      const metadata = command.metadata || {}
      const patientName = metadata.patient || 'Unknown Patient'
      
      const patient = patients.find(p => 
        p.patient_id.toLowerCase().includes(patientName.toLowerCase()) ||
        p.emergency_contact_name.toLowerCase().includes(patientName.toLowerCase())
      )

      // Insert medical record
      const { error } = await supabase
        .from('medical_records')
        .insert({
          patient_id: patient?.id || null,
          doctor_id: command.doctor_id,
          visit_date: new Date().toISOString(),
          chief_complaint: metadata.complaint || 'Voice command update',
          diagnosis: metadata.diagnosis || '',
          treatment_plan: metadata.treatment || '',
          notes: `Updated via voice command: "${command.command_text}"`,
          status: 'completed',
          reviewed_by_doctor: true
        })

      if (error) {
        console.error('Error updating patient record:', error)
      } else {
        console.log('Patient record updated successfully')
      }
    } catch (error) {
      console.error('Error in updatePatientRecordFromCommand:', error)
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`
    return `${Math.floor(diffInMinutes / 1440)} days ago`
  }

  const getIntentIcon = (intent: string) => {
    switch (intent) {
      case 'add_prescription':
        return <FileText className="h-5 w-5 text-purple-600" />
      case 'schedule_appointment':
        return <Calendar className="h-5 w-5 text-green-600" />
      case 'update_patient_record':
        return <User className="h-5 w-5 text-blue-600" />
      default:
        return <Mic className="h-5 w-5 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'requires_review':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'processed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'executed':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Voice Command Reviews</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={loadData}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'requires_review', label: 'Pending Review', count: voiceCommands.filter(cmd => cmd.status === 'requires_review').length },
                { key: 'processed', label: 'Approved', count: voiceCommands.filter(cmd => cmd.status === 'processed').length },
                { key: 'failed', label: 'Rejected', count: voiceCommands.filter(cmd => cmd.status === 'failed').length },
                { key: 'all', label: 'All Commands', count: voiceCommands.length }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as any)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    filter === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                      filter === tab.key
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Voice Commands List */}
        <div className="space-y-4">
          {voiceCommands.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No voice commands</h3>
              <p className="mt-1 text-sm text-gray-500">
                {filter === 'requires_review' 
                  ? 'No commands are currently pending review.'
                  : `No ${filter} commands found.`
                }
              </p>
            </div>
          ) : (
            voiceCommands.map((command) => (
              <div key={command.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="bg-blue-100 rounded-lg p-3">
                      {getIntentIcon(command.processed_intent)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {command.processed_intent.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(command.status)}`}>
                          {command.status.replace('_', ' ')}
                        </span>
                      </div>
                      
                      <div className="bg-gray-50 rounded-lg p-3 mb-3">
                        <p className="text-sm text-gray-700 font-medium mb-1">Voice Command:</p>
                        <p className="text-sm text-gray-900">"{command.command_text}"</p>
                      </div>
                      
                      <div className="mb-3">
                        <p className="text-sm text-gray-700 font-medium mb-1">Proposed Action:</p>
                        <p className="text-sm text-gray-900">{command.action_taken}</p>
                      </div>
                      
                      {command.metadata && Object.keys(command.metadata).length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm text-gray-700 font-medium mb-1">Extracted Information:</p>
                          <div className="bg-blue-50 rounded-lg p-3">
                            {Object.entries(command.metadata).map(([key, value]) => (
                              <div key={key} className="flex justify-between text-sm">
                                <span className="text-gray-600 capitalize">{key}:</span>
                                <span className="text-gray-900 font-medium">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>{formatTimeAgo(command.created_at)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span>Confidence: {Math.round(command.confidence_score * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  {command.status === 'requires_review' && (
                    <div className="flex items-center space-x-3 ml-4">
                      <button
                        onClick={() => handleApproval(command.id, false)}
                        disabled={processingId === command.id}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50"
                      >
                        {processingId === command.id ? (
                          <RefreshCw className="h-5 w-5 animate-spin" />
                        ) : (
                          <X className="h-5 w-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleApproval(command.id, true)}
                        disabled={processingId === command.id}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors disabled:opacity-50"
                      >
                        {processingId === command.id ? (
                          <RefreshCw className="h-5 w-5 animate-spin" />
                        ) : (
                          <Check className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
