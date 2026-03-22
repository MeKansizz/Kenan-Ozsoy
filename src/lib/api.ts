const BASE_URL = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || 'Request failed')
  }
  return res.json()
}

export const api = {
  // TCMB Kur
  kenanGetTcmbKur: (date?: string) => {
    const qs = date ? `?date=${date}` : ''
    return request<{ eur: number; usd: number }>(`/kenan/tcmb-kur${qs}`)
  },

  // Kullanicilar
  kenanGetUsers: () => request<any[]>('/kenan/users'),
  kenanRegister: (name: string, password: string, admin_user?: string) => request<any>('/kenan/users/register', { method: 'POST', body: JSON.stringify({ name, password, admin_user }) }),
  kenanSetPassword: (name: string, password: string) => request<any>('/kenan/users/set-password', { method: 'POST', body: JSON.stringify({ name, password }) }),
  kenanChangePassword: (name: string, old_password: string, new_password: string) => request<any>('/kenan/users/change-password', { method: 'PUT', body: JSON.stringify({ name, old_password, new_password }) }),

  // Login
  kenanGetLoginLog: () => request<any[]>('/kenan/login-log'),
  kenanLogin: (user_name: string, password: string) => request<any>('/kenan/login', { method: 'POST', body: JSON.stringify({ user_name, password }) }),

  // Audit Log
  kenanGetAuditLog: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<any[]>(`/kenan/audit-log${qs}`)
  },

  // Cari
  kenanGetCari: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<any[]>(`/kenan/cari${qs}`)
  },

  // Odemeler
  kenanGetOdemeler: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<any[]>(`/kenan/odemeler${qs}`)
  },
  kenanCreateOdeme: (data: any) => request<any>('/kenan/odemeler', { method: 'POST', body: JSON.stringify(data) }),
  kenanUpdateOdeme: (id: string, data: any) => request<any>(`/kenan/odemeler/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  kenanDeleteOdeme: (id: string, user?: string) => request<any>(`/kenan/odemeler/${id}?user=${user || ''}`, { method: 'DELETE' }),

  // Siparisler
  kenanGetSiparisler: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<any[]>(`/kenan/siparisler${qs}`)
  },
  kenanCreateSiparis: (data: any) => request<any>('/kenan/siparisler', { method: 'POST', body: JSON.stringify(data) }),
  kenanUpdateSiparis: (id: string, data: any) => request<any>(`/kenan/siparisler/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  kenanDeleteSiparis: (id: string, user?: string) => request<any>(`/kenan/siparisler/${id}?user=${user || ''}`, { method: 'DELETE' }),
}
