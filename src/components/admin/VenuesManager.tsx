import React, { useState } from 'react';
import { RoomConfig, Venue } from '../../types';
import { MapPin, Plus, Trash2, Edit2, Check, X, Users, DoorOpen } from 'lucide-react';

interface VenuesManagerProps {
  venues: Venue[];
  onSaveVenue: (venue: Venue) => Promise<void>;
  onDeleteVenue?: (venueId: string) => Promise<void>;
}

export const VenuesManager: React.FC<VenuesManagerProps> = ({
  venues,
  onSaveVenue,
  onDeleteVenue
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [address, setAddress] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [rooms, setRooms] = useState<RoomConfig[]>([
    { id: 'R1', name: 'কক্ষ ১০১', benches: 12, perBench: 2 }
  ]);

  const resetForm = () => {
    setName('');
    setNameEn('');
    setAddress('');
    setMapUrl('');
    setContactPerson('');
    setContactPhone('');
    setRooms([{ id: 'R1', name: 'কক্ষ ১০১', benches: 12, perBench: 2 }]);
    setIsAdding(false);
    setEditingId(null);
  };

  const startEdit = (v: Venue) => {
    setEditingId(v.id);
    setName(v.name);
    setNameEn(v.nameEn || '');
    setAddress(v.address);
    setMapUrl(v.mapUrl || '');
    setContactPerson(v.contactPerson);
    setContactPhone(v.contactPhone);
    setRooms(v.rooms && v.rooms.length > 0 ? v.rooms : [{ id: 'R1', name: 'কক্ষ ১০১', benches: 12, perBench: 2 }]);
    setIsAdding(true);
  };

  const handleAddRoom = () => {
    const nextNum = rooms.length + 1;
    setRooms([
      ...rooms,
      { id: `R${Date.now()}`, name: `কক্ষ ১০${nextNum}`, benches: 12, perBench: 2 }
    ]);
  };

  const handleUpdateRoom = (index: number, field: keyof RoomConfig, value: any) => {
    const updated = [...rooms];
    updated[index] = { ...updated[index], [field]: value };
    setRooms(updated);
  };

  const handleRemoveRoom = (index: number) => {
    if (rooms.length <= 1) return;
    setRooms(rooms.filter((_, i) => i !== index));
  };

  const calculateCapacity = (roomList: RoomConfig[]) => {
    return roomList.reduce((sum, r) => sum + (r.benches * r.perBench), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) return;

    const maxNum = venues.reduce((max, v) => {
      const n = parseInt(v.id.replace(/\D/g, ''), 10);
      return !isNaN(n) && n > max ? n : max;
    }, 0);
    const nextId = `V${String(maxNum + 1).padStart(2, '0')}`;

    const newVenue: Venue = {
      id: editingId || nextId,
      name: name.trim(),
      nameEn: nameEn.trim(),
      address: address.trim(),
      mapUrl: mapUrl.trim(),
      contactPerson: contactPerson.trim(),
      contactPhone: contactPhone.trim(),
      rooms
    };

    await onSaveVenue(newVenue);
    resetForm();
  };

  const handleDelete = async (venue: Venue) => {
    if (!onDeleteVenue) return;
    if (!window.confirm(`আপনি কি নিশ্চিতভাবে ভেন্যু "${venue.name}" (${venue.id}) মুছে ফেলতে চান?`)) {
      return;
    }
    await onDeleteVenue(venue.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>ভেন্যু ও পরীক্ষা কেন্দ্র ব্যবস্থাপনা</span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            পরীক্ষার কেন্দ্র, যোগাযোগের তথ্য এবং আসন বিন্যাসের জন্য কক্ষ ও বেঞ্চ কনফিগারেশন।
          </p>
        </div>

        {!isAdding && (
          <button
            onClick={() => {
              resetForm();
              setIsAdding(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন ভেন্যু যোগ করুন</span>
          </button>
        )}
      </div>

      {/* Add / Edit Form Modal or Panel */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-md space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-slate-700">
            <h3 className="font-bold text-gray-900 dark:text-white">
              {editingId ? 'ভেন্যু সম্পাদনা করুন' : 'নতুন ভেন্যু তথ্য দিন'}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                ভেন্যুর নাম (বাংলা) *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="যেমন: তেতইগাঁও রশীদ উদ্দিন উচ্চ বিদ্যালয়"
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Venue Name in English
              </label>
              <input
                type="text"
                value={nameEn}
                onChange={e => setNameEn(e.target.value)}
                placeholder="e.g. Tetaigaon Rashid Uddin High School"
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                ঠিকানা ও অবস্থান *
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="যেমন: আদমপুর বাজার, কমলগঞ্জ, মৌলভীবাজার"
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                গুগল ম্যাপ লিংক (ঐচ্ছিক)
              </label>
              <input
                type="url"
                value={mapUrl}
                onChange={e => setMapUrl(e.target.value)}
                placeholder="https://maps.google.com/?q=..."
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                দায়িত্বপ্রাপ্ত ব্যক্তি
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={e => setContactPerson(e.target.value)}
                placeholder="যেমন: শান্তনু সিংহ"
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                মোবাইল নম্বর
              </label>
              <input
                type="text"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                placeholder="01717-557419"
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Rooms and Benches Configuration */}
          <div className="pt-3 border-t border-gray-100 dark:border-slate-700">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-1.5">
                <DoorOpen className="w-4 h-4 text-indigo-600" />
                <span>কক্ষ ও আসন বিন্যাস কনফিগারেশন (মোট আসন: {calculateCapacity(rooms)})</span>
              </label>
              <button
                type="button"
                onClick={handleAddRoom}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>আরেকটি কক্ষ যোগ করুন</span>
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {rooms.map((room, idx) => (
                <div key={room.id} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 text-xs">
                  <span className="w-6 font-bold text-gray-400">{idx + 1}.</span>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={room.name}
                      onChange={e => handleUpdateRoom(idx, 'name', e.target.value)}
                      placeholder="কক্ষের নাম (যেমন: কক্ষ ১০১)"
                      className="w-full px-2 py-1 border rounded dark:bg-slate-800 dark:border-slate-600 text-xs"
                    />
                  </div>
                  <div className="w-28 flex items-center gap-1">
                    <span>বেঞ্চ:</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={room.benches}
                      onChange={e => handleUpdateRoom(idx, 'benches', parseInt(e.target.value, 10) || 1)}
                      className="w-14 px-1 py-1 border rounded dark:bg-slate-800 dark:border-slate-600 text-xs text-center font-mono"
                    />
                  </div>
                  <div className="w-36 flex items-center gap-1">
                    <span>প্রতি বেঞ্চে:</span>
                    <select
                      value={room.perBench}
                      onChange={e => handleUpdateRoom(idx, 'perBench', parseInt(e.target.value, 10) || 2)}
                      className="px-1 py-1 border rounded dark:bg-slate-800 dark:border-slate-600 text-xs"
                    >
                      <option value={1}>১ জন</option>
                      <option value={2}>২ জন</option>
                      <option value={3}>৩ জন</option>
                    </select>
                  </div>
                  <span className="w-20 font-mono font-semibold text-gray-700 dark:text-gray-300">
                    = {room.benches * room.perBench} আসন
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRoom(idx)}
                    disabled={rooms.length <= 1}
                    className="p-1 text-red-500 hover:text-red-700 disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 border rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              বাতিল
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm shadow flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>সংরক্ষণ করুন</span>
            </button>
          </div>
        </form>
      )}

      {/* Venues Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {venues.map(v => {
          const totalSeats = calculateCapacity(v.rooms || []);
          return (
            <div
              key={v.id}
              className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow transition flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="inline-block px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded text-xs font-mono font-semibold mb-1">
                      {v.id}
                    </span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">
                      {v.name}
                    </h3>
                    {v.nameEn && <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{v.nameEn}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(v)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                      title="সম্পাদনা করুন"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {onDeleteVenue && (
                      <button
                        onClick={() => handleDelete(v)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-slate-700"
                        title="ভেন্যু মুছে ফেলুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>{v.address}</span>
                </p>

                {v.contactPerson && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    যোগাযোগ: {v.contactPerson} {v.contactPhone && `(${v.contactPhone})`}
                  </p>
                )}

                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <DoorOpen className="w-4 h-4 text-gray-400" />
                    <span>মোট কক্ষ: {v.rooms?.length || 0} টি</span>
                  </span>
                  <span className="font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1 font-mono">
                    <Users className="w-4 h-4" />
                    <span>{totalSeats} মোট আসন</span>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
