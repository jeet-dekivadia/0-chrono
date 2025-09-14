'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Mic, 
  FileText, 
  Plus, 
  Search,
  Filter,
  User,
  Calendar,
  Clock,
  ArrowLeft,
  RefreshCw,
  Play,
  Pause,
  Download,
  Edit,
  Trash2,
  Volume2,
  MicOff
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Transcription {
  id: string
  patient_id: string
  patient_name: string
  session_type: 'consultation' | 'follow_up' | 'emergency' | 'telemedicine'
  recording_date: string
  duration: number // in seconds
  transcript: string
  summary: string
  key_points: string[]
  action_items: string[]
  status: 'processing' | 'completed' | 'reviewed' | 'archived'
  confidence_score: number
  created_at: string
  reviewed_at?: string
  audio_file_url?: string
}

export default function TranscriptionPage() {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [isRecording, setIsRecording] = useState(false)
  const [currentPlayback, setCurrentPlayback] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadTranscriptions()
  }, [])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadTranscriptions()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadTranscriptions = async () => {
    try {
      setLoading(true)
      
      // Create sample transcription data
      const sampleTranscriptions: Transcription[] = [
        {
          id: '1',
          patient_id: 'PAT001',
          patient_name: 'John Smith',
          session_type: 'consultation',
          recording_date: '2024-01-15T10:30:00Z',
          duration: 1800, // 30 minutes
          transcript: 'Patient presents with chest pain that started 3 days ago. Pain is described as sharp, located in the left chest area, worsens with deep breathing. No associated shortness of breath or palpitations. Patient denies recent trauma or heavy lifting. Vital signs stable. Physical examination reveals tenderness over left costal margin. Likely musculoskeletal in nature. Recommended rest, NSAIDs, and follow-up if symptoms persist.',
          summary: 'Patient with acute chest pain, likely musculoskeletal origin. Stable vital signs. Prescribed conservative treatment.',
          key_points: [
            'Chest pain for 3 days',
            'Sharp pain, left-sided',
            'Worsens with breathing',
            'No cardiac symptoms',
            'Musculoskeletal etiology suspected'
          ],
          action_items: [
            'Prescribe NSAIDs',
            'Patient education on symptoms to watch',
            'Follow-up in 1 week if no improvement',
            'Consider chest X-ray if symptoms worsen'
          ],
          status: 'completed',
          confidence_score: 0.95,
          created_at: '2024-01-15T10:30:00Z',
          reviewed_at: '2024-01-15T11:00:00Z'
        },
        {
          id: '2',
          patient_id: 'PAT002',
          patient_name: 'Sarah Johnson',
          session_type: 'follow_up',
          recording_date: '2024-01-18T14:15:00Z',
          duration: 900, // 15 minutes
          transcript: 'Follow-up visit for hypertension management. Patient reports good compliance with medications. Blood pressure today 128/82, improved from last visit. No side effects from current regimen. Patient asks about dietary modifications. Discussed DASH diet principles and sodium restriction. Continue current medications. Next follow-up in 3 months.',
          summary: 'Hypertension follow-up showing good control with current medications. Patient education provided.',
          key_points: [
            'Good medication compliance',
            'BP improved to 128/82',
            'No medication side effects',
            'Interest in dietary changes'
          ],
          action_items: [
            'Continue current BP medications',
            'Provide DASH diet information',
            'Schedule 3-month follow-up',
            'Home BP monitoring log'
          ],
          status: 'reviewed',
          confidence_score: 0.92,
          created_at: '2024-01-18T14:15:00Z',
          reviewed_at: '2024-01-18T14:45:00Z'
        },
        {
          id: '3',
          patient_id: 'PAT003',
          patient_name: 'Michael Brown',
          session_type: 'telemedicine',
          recording_date: '2024-01-20T09:00:00Z',
          duration: 1200, // 20 minutes
          transcript: 'Telemedicine consultation for diabetes management. Patient reports blood sugars ranging 140-180 mg/dL despite medication compliance. Recent A1C 8.2%. Discussed medication adjustment options. Patient concerned about insulin initiation. Reviewed benefits and addressed concerns. Agreed to start long-acting insulin. Diabetes educator referral arranged.',
          summary: 'Diabetes management consultation via telemedicine. A1C elevated, insulin therapy initiated.',
          key_points: [
            'Blood sugars 140-180 mg/dL',
            'A1C 8.2% (elevated)',
            'Good oral medication compliance',
            'Patient apprehensive about insulin',
            'Education provided'
          ],
          action_items: [
            'Start long-acting insulin',
            'Diabetes educator referral',
            'Insulin injection training',
            'Follow-up in 2 weeks',
            'Continue metformin'
          ],
          status: 'processing',
          confidence_score: 0.88,
          created_at: '2024-01-20T09:00:00Z'
        },
        {
          id: '4',
          patient_id: 'PAT004',
          patient_name: 'Emily Davis',
          session_type: 'emergency',
          recording_date: '2024-01-22T16:45:00Z',
          duration: 600, // 10 minutes
          transcript: 'Emergency consultation for severe abdominal pain. Patient presents with sudden onset right lower quadrant pain, nausea, and low-grade fever. Pain started 6 hours ago, progressively worsening. Physical exam positive for McBurney\'s point tenderness and positive Rovsing\'s sign. CBC shows elevated WBC. Appendicitis suspected. Surgical consultation arranged immediately.',
          summary: 'Emergency presentation with suspected appendicitis. Surgical consultation arranged.',
          key_points: [
            'Sudden RLQ abdominal pain',
            'Nausea and low-grade fever',
            'Positive appendicitis signs',
            'Elevated white blood count',
            'Surgical emergency'
          ],
          action_items: [
            'Immediate surgical consultation',
            'NPO status',
            'IV access and fluids',
            'Pain management',
            'Prepare for possible appendectomy'
          ],
          status: 'completed',
          confidence_score: 0.97,
          created_at: '2024-01-22T16:45:00Z',
          reviewed_at: '2024-01-22T17:00:00Z'
        }
      ]

      setTranscriptions(sampleTranscriptions)
    } catch (error) {
      console.error('Error loading transcriptions:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTranscriptions = transcriptions.filter(transcription => {
    const matchesSearch = transcription.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transcription.transcript.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transcription.summary.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === 'all' || transcription.status === filterStatus
    const matchesType = filterType === 'all' || transcription.session_type === filterType
    
    return matchesSearch && matchesStatus && matchesType
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'reviewed': return 'bg-blue-100 text-blue-800'
      case 'processing': return 'bg-yellow-100 text-yellow-800'
      case 'archived': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getSessionTypeColor = (type: string) => {
    switch (type) {
      case 'consultation': return 'bg-blue-50 text-blue-700'
      case 'follow_up': return 'bg-green-50 text-green-700'
      case 'emergency': return 'bg-red-50 text-red-700'
      case 'telemedicine': return 'bg-purple-50 text-purple-700'
      default: return 'bg-gray-50 text-gray-700'
    }
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const startRecording = () => {
    setIsRecording(true)
    // In a real app, this would start audio recording
    setTimeout(() => {
      setIsRecording(false)
      // Simulate processing
      loadTranscriptions()
    }, 5000)
  }

  const togglePlayback = (transcriptionId: string) => {
    if (currentPlayback === transcriptionId) {
      setCurrentPlayback(null)
    } else {
      setCurrentPlayback(transcriptionId)
      // In a real app, this would play the audio file
      setTimeout(() => {
        setCurrentPlayback(null)
      }, 3000)
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
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                  <FileText className="h-8 w-8 text-blue-600" />
                  Conversation Transcription
                </h1>
                <p className="text-gray-600 mt-1">AI-powered conversation transcription and summary generation</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadTranscriptions}
                className="p-2 text-gray-400 hover:text-gray-600"
                title="Refresh"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
              <button
                onClick={startRecording}
                disabled={isRecording}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-semibold ${
                  isRecording 
                    ? 'bg-red-600 text-white animate-pulse' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                {isRecording ? 'Recording...' : 'Start Recording'}
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
                  placeholder="Search transcriptions by patient, content, or summary..."
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
                <option value="consultation">Consultation</option>
                <option value="follow_up">Follow-up</option>
                <option value="emergency">Emergency</option>
                <option value="telemedicine">Telemedicine</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="reviewed">Reviewed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transcriptions List */}
        <div className="space-y-6">
          {filteredTranscriptions.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No transcriptions found</h3>
              <p className="text-gray-600">No transcriptions match your current filters.</p>
            </div>
          ) : (
            filteredTranscriptions.map((transcription) => (
              <div key={transcription.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-100 rounded-lg p-3">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900">{transcription.patient_name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSessionTypeColor(transcription.session_type)}`}>
                          {transcription.session_type.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(transcription.status)}`}>
                          {transcription.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(transcription.recording_date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatDuration(transcription.duration)}
                        </span>
                        <span>Confidence: {Math.round(transcription.confidence_score * 100)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => togglePlayback(transcription.id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Play/Pause Audio"
                    >
                      {currentPlayback === transcription.id ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </button>
                    <button className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg" title="Download">
                      <Download className="h-5 w-5" />
                    </button>
                    <button className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg" title="Edit">
                      <Edit className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Summary</h4>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{transcription.summary}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Key Points</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      {transcription.key_points.map((point, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-blue-600 mt-1">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Action Items</h4>
                  <div className="flex flex-wrap gap-2">
                    {transcription.action_items.map((item, index) => (
                      <span key={index} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-gray-900 hover:text-blue-600">
                      View Full Transcript
                    </summary>
                    <div className="mt-3 text-sm text-gray-700 bg-gray-50 p-4 rounded-lg max-h-40 overflow-y-auto">
                      {transcription.transcript}
                    </div>
                  </details>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
