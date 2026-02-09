// frontend/src/services/holidayService.ts
import { Holiday, CreateHolidayRequest, UpdateHolidayRequest, ResolvedHoliday } from '../models/Holiday';
import { apiClient } from './apiClient';

export class HolidayService {
  async getHolidays(): Promise<Holiday[]> {
    console.log('🔄 Fetching holidays from API...');
    try {
      const holidays = await apiClient.get<Holiday[]>('/holidays');
      console.log('✅ Holidays received:', holidays.length);
      return holidays;
    } catch (error) {
      console.error('❌ Error fetching holidays:', error);
      throw error;
    }
  }

  async getHolidaysInRange(startDate: string, endDate: string): Promise<ResolvedHoliday[]> {
    console.log('🔄 Fetching holidays in range:', startDate, 'to', endDate);
    try {
      const holidays = await apiClient.get<ResolvedHoliday[]>(
        `/holidays/range?start=${startDate}&end=${endDate}`
      );
      console.log('✅ Resolved holidays received:', holidays.length);
      return holidays;
    } catch (error) {
      console.error('❌ Error fetching holidays in range:', error);
      throw error;
    }
  }

  async getHoliday(id: string): Promise<Holiday> {
    console.log('🔄 Fetching holiday:', id);
    return apiClient.get<Holiday>(`/holidays/${id}`);
  }

  async createHoliday(holiday: CreateHolidayRequest): Promise<Holiday> {
    console.log('🔄 Creating holiday:', holiday.name);
    return apiClient.post<Holiday>('/holidays', holiday);
  }

  async updateHoliday(id: string, holiday: UpdateHolidayRequest): Promise<Holiday> {
    console.log('🔄 Updating holiday:', id);
    return apiClient.put<Holiday>(`/holidays/${id}`, holiday);
  }

  async deleteHoliday(id: string): Promise<void> {
    console.log('🔄 Deleting holiday:', id);
    await apiClient.delete(`/holidays/${id}`);
  }
}

export const holidayService = new HolidayService();
