'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as d3 from 'd3'
import { ArrowLeft, RefreshCw, Search, Filter, Zap, Users, Activity } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Patient {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string
  medical_conditions: string[]
  emergency_contact_name: string
  emergency_contact_phone: string
  insurance_provider: string
  last_visit: string
  status: 'active' | 'inactive' | 'critical'
}

interface Appointment {
  id: string
  patient_id: string
  doctor_id: string
  appointment_type: string
  scheduled_date: string
  status: string
}

interface Prescription {
  id: string
  patient_id: string
  medication_name: string
  dosage: string
  frequency: string
  prescribed_date: string
}

interface NetworkNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  type: 'patient' | 'condition' | 'medication' | 'doctor'
  size: number
  color: string
  data: any
  connections: number
}

interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  source: string | NetworkNode
  target: string | NetworkNode
  type: 'appointment' | 'prescription' | 'condition' | 'emergency_contact'
  strength: number
}

export default function PatientVisualization() {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const [patients, setPatients] = useState<Patient[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [aiInsights, setAiInsights] = useState<string[]>([])
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null)

  useEffect(() => {
    loadVisualizationData()
  }, [])

  const loadVisualizationData = async () => {
    setLoading(true)
    try {
      // Load patients
      const { data: patientsData } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false })

      // Load appointments
      const { data: appointmentsData } = await supabase
        .from('appointments')
        .select('*')
        .order('scheduled_date', { ascending: false })

      // Load prescriptions
      const { data: prescriptionsData } = await supabase
        .from('prescriptions')
        .select('*')
        .order('prescribed_date', { ascending: false })

      setPatients(patientsData || [])
      setAppointments(appointmentsData || [])
      setPrescriptions(prescriptionsData || [])

      // Generate AI insights
      generateAiInsights(patientsData || [], appointmentsData || [], prescriptionsData || [])
    } catch (error) {
      console.error('Error loading visualization data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateAiInsights = async (patients: Patient[], appointments: Appointment[], prescriptions: Prescription[]) => {
    // Simulate Cerebras AI analysis
    const insights = [
      `📊 Network Analysis: ${patients.length} patients with ${appointments.length} appointments and ${prescriptions.length} prescriptions`,
      `🔗 High-connectivity patients: ${patients.filter(p => getPatientConnections(p.id, appointments, prescriptions) > 5).length} patients have >5 connections`,
      `⚠️ Critical patients: ${patients.filter(p => p.status === 'critical').length} patients require immediate attention`,
      `💊 Most prescribed medication: ${getMostPrescribedMedication(prescriptions)}`,
      `📅 Peak appointment times: ${getPeakAppointmentTimes(appointments)}`,
      `🏥 Insurance distribution: ${getInsuranceDistribution(patients)}`,
      `🔄 Patient flow patterns: ${getPatientFlowPatterns(appointments)}`,
    ]
    setAiInsights(insights)
  }

  const getPatientConnections = (patientId: string, appointments: Appointment[], prescriptions: Prescription[]) => {
    const appointmentCount = appointments.filter(a => a.patient_id === patientId).length
    const prescriptionCount = prescriptions.filter(p => p.patient_id === patientId).length
    return appointmentCount + prescriptionCount
  }

  const getMostPrescribedMedication = (prescriptions: Prescription[]) => {
    const medCounts = prescriptions.reduce((acc, p) => {
      acc[p.medication_name] = (acc[p.medication_name] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    return Object.entries(medCounts).sort(([,a], [,b]) => b - a)[0]?.[0] || 'None'
  }

  const getPeakAppointmentTimes = (appointments: Appointment[]) => {
    const hourCounts = appointments.reduce((acc, a) => {
      const hour = new Date(a.scheduled_date).getHours()
      acc[hour] = (acc[hour] || 0) + 1
      return acc
    }, {} as Record<number, number>)
    const peakHour = Object.entries(hourCounts).sort(([,a], [,b]) => b - a)[0]?.[0]
    return peakHour ? `${peakHour}:00` : 'No data'
  }

  const getInsuranceDistribution = (patients: Patient[]) => {
    const insuranceCounts = patients.reduce((acc, p) => {
      acc[p.insurance_provider] = (acc[p.insurance_provider] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    const topInsurance = Object.entries(insuranceCounts).sort(([,a], [,b]) => b - a)[0]
    return topInsurance ? `${topInsurance[0]} (${topInsurance[1]} patients)` : 'No data'
  }

  const getPatientFlowPatterns = (appointments: Appointment[]) => {
    const typeCount = appointments.reduce((acc, a) => {
      acc[a.appointment_type] = (acc[a.appointment_type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    const topType = Object.entries(typeCount).sort(([,a], [,b]) => b - a)[0]
    return topType ? `${topType[0]} (${topType[1]} appointments)` : 'No patterns detected'
  }

  const createNetworkData = () => {
    const nodes: NetworkNode[] = []
    const links: NetworkLink[] = []

    // Create patient nodes with null safety
    patients.forEach(patient => {
      if (!patient || !patient.id) return
      
      const connections = getPatientConnections(patient.id, appointments, prescriptions)
      const firstName = patient.first_name || 'Unknown'
      const lastName = patient.last_name || 'Patient'
      
      nodes.push({
        id: patient.id,
        name: `${firstName} ${lastName}`,
        type: 'patient',
        size: Math.max(10, connections * 2),
        color: patient.status === 'critical' ? '#ef4444' : patient.status === 'active' ? '#10b981' : '#6b7280',
        data: patient,
        connections
      })
    })

    // Create condition nodes
    const conditions = new Set<string>()
    patients.forEach(patient => {
      if (patient.medical_conditions) {
        patient.medical_conditions.forEach(condition => conditions.add(condition))
      }
    })

    conditions.forEach(condition => {
      const patientCount = patients.filter(p => p.medical_conditions?.includes(condition)).length
      nodes.push({
        id: `condition_${condition}`,
        name: condition,
        type: 'condition',
        size: Math.max(8, patientCount * 3),
        color: '#8b5cf6',
        data: { condition, patientCount },
        connections: patientCount
      })

      // Link patients to conditions with null safety
      patients.forEach(patient => {
        if (patient && patient.id && patient.medical_conditions?.includes(condition)) {
          links.push({
            source: patient.id,
            target: `condition_${condition}`,
            type: 'condition',
            strength: 0.3
          })
        }
      })
    })

    // Create medication nodes
    const medications = new Set<string>()
    prescriptions.forEach(prescription => medications.add(prescription.medication_name))

    medications.forEach(medication => {
      const prescriptionCount = prescriptions.filter(p => p.medication_name === medication).length
      nodes.push({
        id: `medication_${medication}`,
        name: medication,
        type: 'medication',
        size: Math.max(6, prescriptionCount * 2),
        color: '#f59e0b',
        data: { medication, prescriptionCount },
        connections: prescriptionCount
      })

      // Link patients to medications with null safety
      prescriptions.forEach(prescription => {
        if (prescription && prescription.patient_id && prescription.medication_name === medication) {
          links.push({
            source: prescription.patient_id,
            target: `medication_${medication}`,
            type: 'prescription',
            strength: 0.5
          })
        }
      })
    })

    return { nodes, links }
  }

  useEffect(() => {
    if (!loading && patients.length > 0) {
      renderVisualization()
    }
  }, [loading, patients, appointments, prescriptions, selectedFilter, searchTerm])

  const renderVisualization = () => {
    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const { nodes, links } = createNetworkData()

    // Filter nodes based on search and filter with null safety
    const filteredNodes = nodes.filter(node => {
      if (!node || !node.name || !node.id) return false
      
      const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesFilter = selectedFilter === 'all' || 
        (selectedFilter === 'critical' && node.data?.status === 'critical') ||
        (selectedFilter === 'high-activity' && node.connections > 5) ||
        (selectedFilter === node.type)
      return matchesSearch && matchesFilter
    })

    const filteredLinks = links.filter(link => {
      // Add null safety checks for link.source and link.target
      if (!link.source || !link.target) return false
      
      const sourceId = typeof link.source === 'string' ? link.source : link.source?.id
      const targetId = typeof link.target === 'string' ? link.target : link.target?.id
      
      if (!sourceId || !targetId) return false
      
      const sourceExists = filteredNodes.some(n => n && n.id === sourceId)
      const targetExists = filteredNodes.some(n => n && n.id === targetId)
      return sourceExists && targetExists
    })

    const width = 1200
    const height = 800

    svg.attr("width", width).attr("height", height)

    // Create simulation
    const simulation = d3.forceSimulation(filteredNodes)
      .force("link", d3.forceLink(filteredLinks).id((d: any) => d.id).strength(0.1))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d: any) => d.size + 2))

    // Create links
    const link = svg.append("g")
      .selectAll("line")
      .data(filteredLinks)
      .enter().append("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 2)

    // Create nodes
    const node = svg.append("g")
      .selectAll("circle")
      .data(filteredNodes)
      .enter().append("circle")
      .attr("r", (d: any) => d.size)
      .attr("fill", (d: any) => d.color)
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .call(d3.drag<SVGCircleElement, NetworkNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended))
      .on("click", (event, d) => setSelectedNode(d))
      .on("mouseover", function(event, d) {
        d3.select(this).attr("stroke-width", 4)
        // Show tooltip
        const tooltip = svg.append("g")
          .attr("id", "tooltip")
          .attr("transform", `translate(${d.x! + d.size + 10},${d.y! - 10})`)
        
        tooltip.append("rect")
          .attr("width", 200)
          .attr("height", 60)
          .attr("fill", "rgba(0,0,0,0.8)")
          .attr("rx", 5)
        
        tooltip.append("text")
          .attr("x", 10)
          .attr("y", 20)
          .attr("fill", "white")
          .attr("font-size", "12px")
          .text(d.name)
        
        tooltip.append("text")
          .attr("x", 10)
          .attr("y", 35)
          .attr("fill", "white")
          .attr("font-size", "10px")
          .text(`Type: ${d.type}`)
        
        tooltip.append("text")
          .attr("x", 10)
          .attr("y", 50)
          .attr("fill", "white")
          .attr("font-size", "10px")
          .text(`Connections: ${d.connections}`)
      })
      .on("mouseout", function(event, d) {
        d3.select(this).attr("stroke-width", 2)
        svg.select("#tooltip").remove()
      })

    // Add labels
    const labels = svg.append("g")
      .selectAll("text")
      .data(filteredNodes)
      .enter().append("text")
      .text((d: any) => d.name.length > 15 ? d.name.substring(0, 15) + '...' : d.name)
      .attr("font-size", "10px")
      .attr("fill", "#333")
      .attr("text-anchor", "middle")
      .style("pointer-events", "none")

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y)

      node
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y)

      labels
        .attr("x", (d: any) => d.x)
        .attr("y", (d: any) => d.y + d.size + 15)
    })

    function dragstarted(event: any, d: NetworkNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event: any, d: NetworkNode) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragended(event: any, d: NetworkNode) {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading patient network visualization...</p>
        </div>
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
                onClick={() => router.back()}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Back to Dashboard</span>
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-xl font-semibold text-gray-900">Patient Network Visualization</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={loadVisualizationData}
                className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Controls Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Search and Filter */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Controls</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search patients, conditions..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter</label>
                  <select
                    value={selectedFilter}
                    onChange={(e) => setSelectedFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="all">All Nodes</option>
                    <option value="patient">Patients Only</option>
                    <option value="condition">Conditions Only</option>
                    <option value="medication">Medications Only</option>
                    <option value="critical">Critical Patients</option>
                    <option value="high-activity">High Activity (&gt;5 connections)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* AI Insights */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Zap className="h-5 w-5 text-yellow-500" />
                <h3 className="text-lg font-semibold text-gray-900">AI Insights</h3>
              </div>
              <div className="space-y-3">
                {aiInsights.map((insight, index) => (
                  <div key={index} className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">
                    {insight}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Legend</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Active Patients</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Critical Patients</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Medical Conditions</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Medications</span>
                </div>
              </div>
            </div>

            {/* Selected Node Details */}
            {selectedNode && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Node Details</h3>
                <div className="space-y-2">
                  <p className="text-sm"><strong>Name:</strong> {selectedNode.name}</p>
                  <p className="text-sm"><strong>Type:</strong> {selectedNode.type}</p>
                  <p className="text-sm"><strong>Connections:</strong> {selectedNode.connections}</p>
                  {selectedNode.type === 'patient' && selectedNode.data && (
                    <>
                      <p className="text-sm"><strong>Status:</strong> {selectedNode.data.status}</p>
                      <p className="text-sm"><strong>Insurance:</strong> {selectedNode.data.insurance_provider}</p>
                      <p className="text-sm"><strong>Last Visit:</strong> {new Date(selectedNode.data.last_visit).toLocaleDateString()}</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Visualization */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-purple-600" />
                  <h2 className="text-xl font-semibold text-gray-900">Interactive Network Graph</h2>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Users className="h-4 w-4" />
                  <span>{patients.length} patients visualized</span>
                </div>
              </div>
              
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <svg ref={svgRef} className="w-full" style={{ height: '800px' }}></svg>
              </div>
              
              <div className="mt-4 text-sm text-gray-500 text-center">
                <p>Drag nodes to explore • Click nodes for details • Hover for quick info</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
