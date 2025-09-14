'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  CreditCard, 
  FileText, 
  Plus, 
  Search,
  Filter,
  User,
  Calendar,
  DollarSign,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Upload,
  Eye
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface InsuranceClaim {
  id: string
  patient_id: string
  patient_name: string
  claim_number: string
  insurance_provider: string
  policy_number: string
  service_date: string
  service_type: string
  diagnosis_code: string
  procedure_code: string
  billed_amount: number
  approved_amount: number
  patient_responsibility: number
  status: 'submitted' | 'pending' | 'approved' | 'denied' | 'paid'
  submission_date: string
  processed_date?: string
  notes?: string
  created_at: string
}

export default function InsurancePage() {
  const [claims, setClaims] = useState<InsuranceClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterProvider, setFilterProvider] = useState<string>('all')
  const router = useRouter()

  useEffect(() => {
    loadInsuranceClaims()
  }, [])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadInsuranceClaims()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadInsuranceClaims = async () => {
    try {
      setLoading(true)
      
      // Create sample insurance claims data
      const sampleClaims: InsuranceClaim[] = [
        {
          id: '1',
          patient_id: 'PAT001',
          patient_name: 'John Smith',
          claim_number: 'CLM-2024-001',
          insurance_provider: 'Blue Cross Blue Shield',
          policy_number: 'BCBS123456789',
          service_date: '2024-01-15',
          service_type: 'Office Visit',
          diagnosis_code: 'Z00.00',
          procedure_code: '99213',
          billed_amount: 250.00,
          approved_amount: 200.00,
          patient_responsibility: 50.00,
          status: 'approved',
          submission_date: '2024-01-16',
          processed_date: '2024-01-20',
          notes: 'Routine check-up approved',
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          patient_id: 'PAT002',
          patient_name: 'Sarah Johnson',
          claim_number: 'CLM-2024-002',
          insurance_provider: 'Aetna',
          policy_number: 'AET987654321',
          service_date: '2024-01-18',
          service_type: 'Diagnostic Test',
          diagnosis_code: 'R06.02',
          procedure_code: '71020',
          billed_amount: 450.00,
          approved_amount: 360.00,
          patient_responsibility: 90.00,
          status: 'pending',
          submission_date: '2024-01-19',
          notes: 'Chest X-ray pending review',
          created_at: new Date().toISOString()
        },
        {
          id: '3',
          patient_id: 'PAT003',
          patient_name: 'Michael Brown',
          claim_number: 'CLM-2024-003',
          insurance_provider: 'United Healthcare',
          policy_number: 'UHC456789123',
          service_date: '2024-01-20',
          service_type: 'Specialist Consultation',
          diagnosis_code: 'M79.3',
          procedure_code: '99244',
          billed_amount: 350.00,
          approved_amount: 280.00,
          patient_responsibility: 70.00,
          status: 'paid',
          submission_date: '2024-01-21',
          processed_date: '2024-01-25',
          notes: 'Cardiology consultation completed',
          created_at: new Date().toISOString()
        },
        {
          id: '4',
          patient_id: 'PAT004',
          patient_name: 'Emily Davis',
          claim_number: 'CLM-2024-004',
          insurance_provider: 'Cigna',
          policy_number: 'CIG789123456',
          service_date: '2024-01-22',
          service_type: 'Laboratory Test',
          diagnosis_code: 'Z01.818',
          procedure_code: '80053',
          billed_amount: 180.00,
          approved_amount: 0.00,
          patient_responsibility: 180.00,
          status: 'denied',
          submission_date: '2024-01-23',
          processed_date: '2024-01-26',
          notes: 'Not medically necessary per policy',
          created_at: new Date().toISOString()
        },
        {
          id: '5',
          patient_id: 'PAT005',
          patient_name: 'Robert Wilson',
          claim_number: 'CLM-2024-005',
          insurance_provider: 'Humana',
          policy_number: 'HUM123789456',
          service_date: '2024-01-25',
          service_type: 'Procedure',
          diagnosis_code: 'K21.9',
          procedure_code: '43235',
          billed_amount: 1200.00,
          approved_amount: 960.00,
          patient_responsibility: 240.00,
          status: 'submitted',
          submission_date: '2024-01-26',
          notes: 'Upper endoscopy submitted for review',
          created_at: new Date().toISOString()
        }
      ]

      setClaims(sampleClaims)
    } catch (error) {
      console.error('Error loading insurance claims:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredClaims = claims.filter(claim => {
    const matchesSearch = claim.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         claim.claim_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         claim.insurance_provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         claim.service_type.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === 'all' || claim.status === filterStatus
    const matchesProvider = filterProvider === 'all' || claim.insurance_provider.toLowerCase().includes(filterProvider.toLowerCase())
    
    return matchesSearch && matchesStatus && matchesProvider
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'paid': return 'bg-blue-100 text-blue-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'submitted': return 'bg-purple-100 text-purple-800'
      case 'denied': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="h-4 w-4" />
      case 'paid': return <CheckCircle2 className="h-4 w-4" />
      case 'pending': return <Clock className="h-4 w-4" />
      case 'submitted': return <Upload className="h-4 w-4" />
      case 'denied': return <AlertCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const totalBilled = filteredClaims.reduce((sum, claim) => sum + claim.billed_amount, 0)
  const totalApproved = filteredClaims.reduce((sum, claim) => sum + claim.approved_amount, 0)
  const totalPatientResponsibility = filteredClaims.reduce((sum, claim) => sum + claim.patient_responsibility, 0)

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
                  <CreditCard className="h-8 w-8 text-blue-600" />
                  Insurance & Claims
                </h1>
                <p className="text-gray-600 mt-1">Manage insurance claims and adjudication</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadInsuranceClaims}
                className="p-2 text-gray-400 hover:text-gray-600"
                title="Refresh"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Submit New Claim
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Billed</p>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalBilled)}</p>
              </div>
              <div className="bg-blue-100 rounded-lg p-3">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Approved</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(totalApproved)}</p>
              </div>
              <div className="bg-green-100 rounded-lg p-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Patient Responsibility</p>
                <p className="text-3xl font-bold text-orange-600">{formatCurrency(totalPatientResponsibility)}</p>
              </div>
              <div className="bg-orange-100 rounded-lg p-3">
                <User className="h-6 w-6 text-orange-600" />
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
                  placeholder="Search by patient, claim number, provider, or service..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <select
                value={filterProvider}
                onChange={(e) => setFilterProvider(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Providers</option>
                <option value="blue cross">Blue Cross Blue Shield</option>
                <option value="aetna">Aetna</option>
                <option value="united">United Healthcare</option>
                <option value="cigna">Cigna</option>
                <option value="humana">Humana</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="submitted">Submitted</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
                <option value="denied">Denied</option>
              </select>
            </div>
          </div>
        </div>

        {/* Claims List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Insurance Claims ({filteredClaims.length})
            </h3>
          </div>
          
          {filteredClaims.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No claims found</h3>
              <p className="text-gray-600">No claims match your current filters.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredClaims.map((claim) => (
                <div key={claim.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="bg-blue-100 rounded-lg p-3">
                        <FileText className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">
                            {claim.claim_number}
                          </h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(claim.status)}`}>
                            {getStatusIcon(claim.status)}
                            {claim.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>{claim.patient_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            <span>{claim.insurance_provider}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>Service: {formatDate(claim.service_date)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span>{claim.service_type}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-3">
                          <div className="bg-gray-50 p-3 rounded">
                            <p className="text-gray-600">Billed Amount</p>
                            <p className="font-semibold text-gray-900">{formatCurrency(claim.billed_amount)}</p>
                          </div>
                          <div className="bg-green-50 p-3 rounded">
                            <p className="text-gray-600">Approved Amount</p>
                            <p className="font-semibold text-green-600">{formatCurrency(claim.approved_amount)}</p>
                          </div>
                          <div className="bg-orange-50 p-3 rounded">
                            <p className="text-gray-600">Patient Responsibility</p>
                            <p className="font-semibold text-orange-600">{formatCurrency(claim.patient_responsibility)}</p>
                          </div>
                        </div>
                        {claim.notes && (
                          <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                            <strong>Notes:</strong> {claim.notes}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="View Details">
                        <Eye className="h-5 w-5" />
                      </button>
                      <button className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Download">
                        <Download className="h-5 w-5" />
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
