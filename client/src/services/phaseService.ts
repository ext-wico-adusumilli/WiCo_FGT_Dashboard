/**
 * Phase Service
 * Handles phase and data selection from blob storage
 */

import { Phase, BlobStorageFolder, DataSelectionSummary } from '../types/phase';

class PhaseService {
  private baseUrl = '/api/phases';

  /**
   * Make API request
   */
  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'API request failed');
    }

    return data.data;
  }

  /**
   * Get all available phases
   */
  async getPhases(): Promise<Phase[]> {
    return this.makeRequest<Phase[]>('/');
  }

  /**
   * Get specific phase details
   */
  async getPhase(phaseId: string): Promise<Phase> {
    return this.makeRequest<Phase>(`/${phaseId}`);
  }

  /**
   * Get blob storage structure
   */
  async getBlobStructure(path?: string): Promise<BlobStorageFolder> {
    const params = path ? `?path=${encodeURIComponent(path)}` : '';
    return this.makeRequest<BlobStorageFolder>(`/blob-structure${params}`);
  }

  /**
   * Get data selection summary
   */
  async getDataSummary(phaseIds: string[], dateRange?: { startDate: string; endDate: string }): Promise<DataSelectionSummary> {
    return this.makeRequest<DataSelectionSummary>('/data-summary', {
      method: 'POST',
      body: JSON.stringify({ phaseIds, dateRange }),
    });
  }

  /**
   * Validate data selection
   */
  async validateSelection(phaseIds: string[], dateRange?: { startDate: string; endDate: string }): Promise<{ valid: boolean; message?: string }> {
    return this.makeRequest<{ valid: boolean; message?: string }>('/validate', {
      method: 'POST',
      body: JSON.stringify({ phaseIds, dateRange }),
    });
  }
}

export const phaseService = new PhaseService();
