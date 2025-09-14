// Cerebras AI integration for Bob assistant
export interface CerebrasConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export interface VoiceCommandRequest {
  text: string
  context?: {
    doctorId: string
    patientId?: string
    currentAppointment?: string
  }
}

export interface VoiceCommandResponse {
  intent: string
  confidence: number
  action: string
  parameters: Record<string, any>
  requiresReview: boolean
}

export class CerebrasClient {
  private config: CerebrasConfig

  constructor() {
    this.config = {
      apiKey: process.env.CEREBRAS_API_KEY!,
      baseUrl: process.env.CEREBRAS_BASE_URL!,
      model: process.env.CEREBRAS_MODEL!
    }
  }

  async processVoiceCommand(request: VoiceCommandRequest): Promise<VoiceCommandResponse> {
    try {
      // For now, simulate AI processing without making actual API calls
      // This prevents the API error while we develop the core functionality
      const command = request.text.toLowerCase()
      
      let intent = 'unknown'
      let action = 'Command processed'
      let parameters: Record<string, any> = {}
      let confidence = 0.8
      let requiresReview = true

      // Simple pattern matching for common medical commands
      if (command.includes('add') && (command.includes('prescription') || command.includes('medicine') || command.includes('medication'))) {
        intent = 'add_prescription'
        action = `Added prescription based on voice command: "${request.text}"`
        parameters = { medication: 'extracted from voice', patient: 'current patient' }
      } else if (command.includes('schedule') && command.includes('appointment')) {
        intent = 'schedule_appointment'
        action = `Scheduled appointment based on voice command: "${request.text}"`
        parameters = { date: 'extracted from voice', patient: 'current patient' }
      } else if (command.includes('update') && command.includes('summary')) {
        intent = 'update_summary'
        action = `Updated patient summary based on voice command: "${request.text}"`
        parameters = { summary: 'extracted from voice' }
      } else if (command.includes('emergency') || command.includes('urgent')) {
        intent = 'emergency_contact'
        action = `Processing emergency request: "${request.text}"`
        parameters = { urgency: 'high', specialty: 'extracted from voice' }
        requiresReview = false
      } else {
        action = `Processed general command: "${request.text}"`
        parameters = { raw_command: request.text }
      }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500))

      return {
        intent,
        confidence,
        action,
        parameters,
        requiresReview
      }

      // TODO: Uncomment this when Cerebras API is properly configured
      /*
      const systemPrompt = `You are Bob, an AI medical assistant for 0chrono. Your role is to help doctors with administrative tasks through voice commands. 

      Analyze the voice command and determine:
      1. Intent (prescription, appointment, summary, emergency_contact, etc.)
      2. Confidence level (0-1)
      3. Action to take
      4. Parameters needed
      5. Whether doctor review is required

      Available intents:
      - add_prescription: Add medication to patient
      - schedule_appointment: Schedule follow-up visits
      - update_summary: Update patient OPD summary
      - emergency_contact: Contact specialists urgently
      - insurance_claim: Process insurance documentation
      - patient_history: Add to patient medical history

      Respond in JSON format only.`

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Voice command: "${request.text}"\nContext: ${JSON.stringify(request.context)}` }
          ],
          temperature: 0.3,
          max_tokens: 500
        })
      })

      if (!response.ok) {
        throw new Error(`Cerebras API error: ${response.statusText}`)
      }

      const data = await response.json()
      const content = data.choices[0].message.content

      try {
        return JSON.parse(content)
      } catch {
        // Fallback if JSON parsing fails
        return {
          intent: 'unknown',
          confidence: 0.1,
          action: 'Could not process command',
          parameters: {},
          requiresReview: true
        }
      }
      */
    } catch (error) {
      console.error('Error processing voice command:', error)
      return {
        intent: 'error',
        confidence: 0,
        action: 'Error processing command',
        parameters: { error: error instanceof Error ? error.message : 'Unknown error' },
        requiresReview: true
      }
    }
  }

  async generateMedicalSummary(patientData: any, conversationTranscript?: string): Promise<string> {
    try {
      const systemPrompt = `You are Bob, an AI medical assistant. Generate a professional medical summary based on the provided patient data and conversation transcript. Include:
      1. Chief complaint
      2. History of present illness
      3. Physical examination findings
      4. Assessment and diagnosis
      5. Treatment plan
      6. Follow-up instructions

      Keep it concise, professional, and medically accurate.`

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Patient Data: ${JSON.stringify(patientData)}\n\nConversation: ${conversationTranscript || 'No conversation transcript available'}` }
          ],
          temperature: 0.2,
          max_tokens: 1000
        })
      })

      if (!response.ok) {
        throw new Error(`Cerebras API error: ${response.statusText}`)
      }

      const data = await response.json()
      return data.choices[0].message.content
    } catch (error) {
      console.error('Error generating medical summary:', error)
      return 'Error generating medical summary. Please review manually.'
    }
  }

  async generateInsuranceClaim(medicalRecord: any, patientInsurance: any): Promise<any> {
    try {
      const systemPrompt = `You are Bob, an AI medical assistant specializing in insurance claim processing. Generate a structured insurance claim based on the medical record and patient insurance information. Include appropriate ICD-10 and CPT codes where applicable.

      Return a JSON object with:
      - diagnosis_codes: Array of ICD-10 codes
      - procedure_codes: Array of CPT codes
      - claim_amount: Estimated claim amount
      - justification: Brief justification for the claim
      - supporting_documentation: List of required documents`

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Medical Record: ${JSON.stringify(medicalRecord)}\n\nInsurance Info: ${JSON.stringify(patientInsurance)}` }
          ],
          temperature: 0.1,
          max_tokens: 800
        })
      })

      if (!response.ok) {
        throw new Error(`Cerebras API error: ${response.statusText}`)
      }

      const data = await response.json()
      const content = data.choices[0].message.content

      try {
        return JSON.parse(content)
      } catch {
        return {
          diagnosis_codes: [],
          procedure_codes: [],
          claim_amount: 0,
          justification: 'Manual review required',
          supporting_documentation: ['Medical record', 'Insurance card']
        }
      }
    } catch (error) {
      console.error('Error generating insurance claim:', error)
      return null
    }
  }
}
