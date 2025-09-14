'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Phone, 
  Clock, 
  Plus, 
  Search,
  Filter,
  User,
  MapPin,
  Mail,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Stethoscope,
  Heart,
  Brain,
  Activity,
  Star
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface EmergencyContact {
  id: string
  name: string
  specialty: string
  phone: string
  email: string
  hospital: string
  availability: 'available' | 'busy' | 'unavailable'
  rating: number
  response_time: string
  emergency_type: string[]
  location: string
  created_at: string
}

export default function EmergencyContactsPage() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSpecialty, setFilterSpecialty] = useState<string>('all')
  const [filterAvailability, setFilterAvailability] = useState<string>('all')
  const router = useRouter()

  useEffect(() => {
    loadEmergencyContacts()
  }, [])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadEmergencyContacts()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadEmergencyContacts = async () => {
    try {
      setLoading(true)
      
      // Create sample emergency contacts data
      const sampleContacts: EmergencyContact[] = [
        {
          id: '1',
          name: 'Dr. Sarah Johnson',
          specialty: 'Cardiology',
          phone: '+1-555-0101',
          email: 'sarah.johnson@hospital.com',
          hospital: 'City General Hospital',
          availability: 'available',
          rating: 4.9,
          response_time: '< 5 min',
          emergency_type: ['Heart Attack', 'Cardiac Arrest', 'Chest Pain'],
          location: 'Emergency Room A',
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Dr. Michael Chen',
          specialty: 'Neurology',
          phone: '+1-555-0102',
          email: 'michael.chen@hospital.com',
          hospital: 'Metro Medical Center',
          availability: 'available',
          rating: 4.8,
          response_time: '< 10 min',
          emergency_type: ['Stroke', 'Seizure', 'Head Trauma'],
          location: 'Neuro ICU',
          created_at: new Date().toISOString()
        },
        {
          id: '3',
          name: 'Dr. Emily Rodriguez',
          specialty: 'Emergency Medicine',
          phone: '+1-555-0103',
          email: 'emily.rodriguez@hospital.com',
          hospital: 'Regional Emergency Center',
          availability: 'busy',
          rating: 4.7,
          response_time: '< 15 min',
          emergency_type: ['Trauma', 'Critical Care', 'Multi-organ Failure'],
          location: 'Trauma Bay 1',
          created_at: new Date().toISOString()
        },
        {
          id: '4',
          name: 'Dr. James Wilson',
          specialty: 'Orthopedic Surgery',
          phone: '+1-555-0104',
          email: 'james.wilson@hospital.com',
          hospital: 'Orthopedic Specialty Hospital',
          availability: 'available',
          rating: 4.6,
          response_time: '< 20 min',
          emergency_type: ['Fractures', 'Spinal Injury', 'Joint Dislocation'],
          location: 'OR Suite 3',
          created_at: new Date().toISOString()
        },
        {
          id: '5',
          name: 'Dr. Lisa Park',
          specialty: 'Pediatric Emergency',
          phone: '+1-555-0105',
          email: 'lisa.park@hospital.com',
          hospital: 'Children\'s Medical Center',
          availability: 'available',
          rating: 4.9,
          response_time: '< 8 min',
          emergency_type: ['Pediatric Trauma', 'Respiratory Distress', 'Poisoning'],
          location: 'Pediatric ER',
          created_at: new Date().toISOString()
        }
      ]

      setContacts(sampleContacts)
    } catch (error) {
      console.error('Error loading emergency contacts:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.hospital.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.emergency_type.some(type => type.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesSpecialty = filterSpecialty === 'all' || contact.specialty.toLowerCase().includes(filterSpecialty.toLowerCase())
    const matchesAvailability = filterAvailability === 'all' || contact.availability === filterAvailability
    
    return matchesSearch && matchesSpecialty && matchesAvailability
  })

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'available': return 'bg-green-100 text-green-800'
      case 'busy': return 'bg-yellow-100 text-yellow-800'
      case 'unavailable': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getSpecialtyIcon = (specialty: string) => {
    if (specialty.toLowerCase().includes('cardiology') || specialty.toLowerCase().includes('heart')) {
      return <Heart className="h-5 w-5 text-red-600" />
    } else if (specialty.toLowerCase().includes('neurology') || specialty.toLowerCase().includes('brain')) {
      return <Brain className="h-5 w-5 text-purple-600" />
    } else if (specialty.toLowerCase().includes('emergency')) {
      return <AlertTriangle className="h-5 w-5 text-orange-600" />
    } else if (specialty.toLowerCase().includes('pediatric')) {
      return <Activity className="h-5 w-5 text-blue-600" />
    } else {
      return <Stethoscope className="h-5 w-5 text-gray-600" />
    }
  }

  const initiateEmergencyCall = (contact: EmergencyContact) => {
    // In a real app, this would integrate with phone system
    window.open(`tel:${contact.phone}`)
  }

  const sendEmergencyEmail = (contact: EmergencyContact) => {
    // In a real app, this would send urgent email
    window.open(`mailto:${contact.email}?subject=URGENT: Medical Emergency&body=This is an urgent medical emergency requiring immediate attention.`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-red-600 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 text-red-100 hover:text-white"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8" />
                  Emergency Contacts
                </h1>
                <p className="text-red-100 mt-1">Immediate access to specialized medical professionals</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadEmergencyContacts}
                className="p-2 text-red-100 hover:text-white"
                title="Refresh"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
              <button className="bg-white text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2 font-semibold">
                <Plus className="h-5 w-5" />
                Add Emergency Contact
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Emergency Banner */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="bg-red-100 rounded-full p-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-900">Emergency Protocol</h3>
              <p className="text-red-700">For life-threatening emergencies, call 911 immediately. Use these contacts for urgent medical consultations and specialized care coordination.</p>
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
                  placeholder="Search by name, specialty, hospital, or emergency type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <select
                value={filterSpecialty}
                onChange={(e) => setFilterSpecialty(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="all">All Specialties</option>
                <option value="cardiology">Cardiology</option>
                <option value="neurology">Neurology</option>
                <option value="emergency">Emergency Medicine</option>
                <option value="orthopedic">Orthopedic Surgery</option>
                <option value="pediatric">Pediatric Emergency</option>
              </select>
              <select
                value={filterAvailability}
                onChange={(e) => setFilterAvailability(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="all">All Availability</option>
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>
          </div>
        </div>

        {/* Emergency Contacts List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Emergency Specialists ({filteredContacts.length})
            </h3>
          </div>
          
          {filteredContacts.length === 0 ? (
            <div className="p-12 text-center">
              <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No emergency contacts found</h3>
              <p className="text-gray-600">No contacts match your current filters.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredContacts.map((contact) => (
                <div key={contact.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="bg-red-100 rounded-lg p-3">
                        {getSpecialtyIcon(contact.specialty)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">
                            {contact.name}
                          </h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAvailabilityColor(contact.availability)}`}>
                            {contact.availability.toUpperCase()}
                          </span>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-400 fill-current" />
                            <span className="text-sm text-gray-600">{contact.rating}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                          <div className="flex items-center gap-2">
                            <Stethoscope className="h-4 w-4" />
                            <span>{contact.specialty}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{contact.hospital}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>Response: {contact.response_time}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>{contact.location}</span>
                          </div>
                        </div>
                        <div className="mb-3">
                          <p className="text-sm text-gray-700 mb-1"><strong>Emergency Types:</strong></p>
                          <div className="flex flex-wrap gap-2">
                            {contact.emergency_type.map((type, index) => (
                              <span key={index} className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs">
                                {type}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <button
                        onClick={() => initiateEmergencyCall(contact)}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 font-semibold"
                      >
                        <Phone className="h-4 w-4" />
                        Call Now
                      </button>
                      <button
                        onClick={() => sendEmergencyEmail(contact)}
                        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                      >
                        <Mail className="h-4 w-4" />
                        Email
                      </button>
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
