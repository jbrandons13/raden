'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Calendar as CalendarIcon, Printer, Trash2, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

export default function StaffSchedulesPage() {
  const [currentMonth, setCurrentMonth] = useState('April 2026');
  
  const shifts = [
    { code: 'EM', time: '05-13', color: 'bg-orange-100 text-orange-700' },
    { code: 'EMS', time: '05-10', color: 'bg-yellow-100 text-yellow-700' },
    { code: 'M', time: '08-16', color: 'bg-green-100 text-green-700' },
    { code: 'A', time: '13-21', color: 'bg-purple-100 text-purple-700' },
    { code: 'AS', time: '15-20', color: 'bg-pink-100 text-pink-700' },
  ];

  const staffList = [
    { id: '1', name: 'Andi', position: 'Pastry Chef' },
    { id: '2', name: 'Budi', position: 'Assistant' },
    { id: '3', name: 'Citra', position: 'Packaging' },
    { id: '4', name: 'Dedi', position: 'General' },
  ];

  // Mock schedule data: [staffId][day]
  const [schedules, setSchedules] = useState<any>({
    '1': { '9': 'EM', '10': 'EM', '11': 'M' },
    '2': { '9': 'EMS', '10': 'A' },
    '3': { '9': 'M', '10': 'M' },
    '4': { '9': 'A', '10': 'AS' },
  });

  const days = Array.from({ length: 7 }, (_, i) => 9 + i); // Showing a week starting from the 9th

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-raden-green">Staff & Jadwal Kerja</h1>
          <p className="text-gray-500">Atur shift dan kehadiran 15-20 staf part-time.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-bold text-raden-green hover:bg-gray-50 transition-all shadow-sm">
            <Printer size={18} /> Cetak Absensi
          </button>
          <button className="flex items-center gap-2 bg-raden-gold px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg active:scale-95">
            <UserPlus size={18} /> Tambah Staff
          </button>
        </div>
      </div>

      {/* Shift Legend */}
      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <Clock size={14} /> Legenda Shift
        </h3>
        <div className="flex flex-wrap gap-4">
          {shifts.map(s => (
            <div key={s.code} className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-lg text-xs font-bold ${s.color}`}>{s.code}</span>
              <span className="text-xs text-gray-400 font-medium font-mono">({s.time})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-200 rounded-full transition-colors"><ChevronLeft size={20}/></button>
            <h3 className="font-bold text-lg text-raden-green">{currentMonth}</h3>
            <button className="p-2 hover:bg-gray-200 rounded-full transition-colors"><ChevronRight size={20}/></button>
          </div>
          <div className="text-xs font-bold text-gray-400 italic">Klik pada sel untuk ubah shift</div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="p-4 text-left border-r border-gray-100 w-48 sticky left-0 bg-gray-50 z-20">Staf</th>
                {days.map(d => (
                  <th key={d} className="p-4 text-center border-r border-gray-100 min-w-[80px]">
                    <div className="text-[10px] text-gray-400 font-bold uppercase">Kamis</div>
                    <div className="text-lg font-bold text-raden-green">{d}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staffList.map((staff) => (
                <tr key={staff.id} className="hover:bg-gray-50/30 transition-colors group">
                  <td className="p-4 border-r border-gray-100 sticky left-0 bg-white group-hover:bg-gray-50 z-20">
                    <p className="font-bold text-raden-green">{staff.name}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-medium">{staff.position}</p>
                  </td>
                  {days.map(d => {
                    const shiftCode = schedules[staff.id]?.[d.toString()];
                    const shiftInfo = shifts.find(s => s.code === shiftCode);
                    return (
                      <td key={d} className="p-2 border-r border-gray-100 text-center">
                        <select 
                          value={shiftCode || ''}
                          onChange={(e) => {
                            const newCode = e.target.value;
                            setSchedules((prev: any) => ({
                              ...prev,
                              [staff.id]: {
                                ...prev[staff.id],
                                [d.toString()]: newCode
                              }
                            }));
                          }}
                          className={`w-full h-10 rounded-xl text-center font-bold text-xs appearance-none cursor-pointer border-none focus:ring-2 focus:ring-raden-gold outline-none ${
                            shiftInfo ? shiftInfo.color : 'bg-gray-50 text-gray-300'
                          }`}
                        >
                          <option value="">-</option>
                          {shifts.map(s => <option key={s.code} value={s.code}>{s.code}</option>)}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
