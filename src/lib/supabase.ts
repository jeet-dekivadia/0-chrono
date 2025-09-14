import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our database schema
export interface UserProfile {
  id: string
  auth_user_id: string
  email: string
  full_name: string
  role: 'doctor' | 'nurse' | 'admin' | 'patient' | 'specialist'
  phone?: string
  license_number?: string
  specialization?: string
  department?: string
  is_active: boolean
  profile_image_url?: string
  created_at: string
  updated_at: string
}

export interface Patient {
  id: string
  user_profile_id: string
  patient_id: string
  date_of_birth: string
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say'
  blood_type?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  address?: string
  insurance_provider?: string
  insurance_policy_number?: string
  insurance_group_number?: string
  medical_history?: string
  allergies?: string
  current_medications?: string
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: string
  patient_id: string
  doctor_id: string
  appointment_type: string
  scheduled_date: string
  duration_minutes: number
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  chief_complaint?: string
  notes?: string
  room_number?: string
  created_at: string
  updated_at: string
}

export interface MedicalRecord {
  id: string
  patient_id: string
  doctor_id: string
  appointment_id?: string
  visit_date: string
  chief_complaint?: string
  history_of_present_illness?: string
  physical_examination?: string
  vital_signs?: any
  diagnosis?: string
  treatment_plan?: string
  follow_up_instructions?: string
  next_visit_date?: string
  status: 'draft' | 'reviewed' | 'finalized' | 'sent_to_patient'
  created_by_bob: boolean
  reviewed_by_doctor: boolean
  created_at: string
  updated_at: string
}

export interface Prescription {
  id: string
  medical_record_id: string
  patient_id: string
  doctor_id: string
  medication_name: string
  dosage: string
  frequency: string
  duration?: string
  quantity?: number
  refills: number
  instructions?: string
  status: 'active' | 'completed' | 'cancelled' | 'expired'
  prescribed_date: string
  created_by_bob: boolean
  reviewed_by_doctor: boolean
  created_at: string
  updated_at: string
}

export interface VoiceCommand {
  id: string
  doctor_id: string
  patient_id?: string
  command_text: string
  processed_intent?: string
  action_taken?: string
  confidence_score?: number
  status: 'pending' | 'processed' | 'executed' | 'failed' | 'requires_review'
  metadata?: any
  created_at: string
  processed_at?: string
}
