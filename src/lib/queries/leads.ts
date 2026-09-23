import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiUpload, apiDownload } from '@/lib/api';

// ============ TYPES ============
export interface Lead {
  id: number;
  tenant_id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  source: string;
  status: string;
  priority: string;
  value: number;
  assigned_to: number | null;
  score: number;
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  proposal_sent?: number;
  won: number;
  lost: number;
}

export interface LeadFilters {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateLeadPayload {
  name: string;
  email: string;
  phone: string;
  company?: string;
  message: string;
  source: string;
  priority: string;
  value: number;
  assigned_to?: number | null;
  custom_fields?: Record<string, any>;
}

export interface UpdateLeadPayload {
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  status: string;
  priority: string;
  value: number;
}

export interface ImportLeadsResult {
  total_rows: number;
  imported: number;
  failed: number;
  errors: string[];
}

// ============ HOOKS ============

// List leads
export function useLeads(filters?: LeadFilters) {
  return useQuery({
    queryKey: ['leads', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.limit) params.append('limit', String(filters.limit));
      if (filters?.offset) params.append('offset', String(filters.offset));

      const query = params.toString();
      return apiFetch<Lead[]>(`/api/v1/leads${query ? `?${query}` : ''}`);
    },
  });
}

// Single lead
export function useLead(id: number) {
  return useQuery({
    queryKey: ['leads', id],
    queryFn: () => apiFetch<Lead>(`/api/v1/leads/${id}`),
    enabled: !!id,
  });
}

// Stats
export function useLeadStats() {
  return useQuery({
    queryKey: ['leads', 'stats'],
    queryFn: () => apiFetch<LeadStats>('/api/v1/leads/stats'),
  });
}

// Create lead
export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLeadPayload) =>
      apiFetch<Lead>('/api/v1/leads', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

// Update lead (full update via PUT)
export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateLeadPayload }) =>
      apiFetch<Lead>(`/api/v1/leads/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

// Update status
export function useUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch<Lead>(`/api/v1/leads/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

// Delete lead
export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ message: string }>(`/api/v1/leads/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

// Import leads from CSV
export function useImportLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiUpload<ImportLeadsResult>('/api/v1/leads/import', formData);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

// Export leads as CSV (optional status filter)
export function useExportLeads() {
  return useMutation({
    mutationFn: (status?: string) => {
      const params = new URLSearchParams();
      if (status && status !== 'all') params.append('status', status);
      const query = params.toString();
      const filename = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
      return apiDownload(`/api/v1/leads/export${query ? `?${query}` : ''}`, filename);
    },
  });
}