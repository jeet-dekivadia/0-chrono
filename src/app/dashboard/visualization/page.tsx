"use client"

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Activity } from 'lucide-react'

const GraphCanvas = dynamic(() => import('./GraphCanvas'), { ssr: false })

export default function VisualizationPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50">
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
              <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-600" />
                Knowledge Graph Visualization
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <GraphCanvas />
        </div>
      </div>
    </div>
  )
}
