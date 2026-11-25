import React, { useState, useEffect, useMemo } from 'react';
import { Student, Venue, ContestSettings, RoomInvigilator, RoomConfig } from '../../types';
import {
  generateSeatPlan,
  generateMultiVenueSeatPlan,
  SeatAssignment,
  SeatPlanResult
} from '../../services/seatPlanAlgorithm';
import { toBengaliDigits } from '../../services/idSystem';
import { getPreferredExamVenueId } from '../../services/defaultData';
import {
  Armchair,
  Play,
  Shuffle,
  Printer,
  Download,
  CheckCircle2,
  ArrowLeftRight,
  FileText,
  UserCheck,
  Plus,
  Trash2,
  Edit2,
  Building,
  AlertCircle,
  Save
} from 'lucide-react';

export const COMBINED_V02_V03_ID = 'COMBINED_V02_V03';

interface SeatPlanGeneratorProps {
  venues: Venue[];
  students: Student[];
  settings: ContestSettings;
  seatPlans?: SeatPlanResult[];
  onSaveSettings: (settings: ContestSettings) => Promise<void>;
  onSaveVenue?: (venue: Venue) => Promise<void>;
  onSaveSeatPlans?: (plans: SeatPlanResult[], updatedStudents: Student[]) => Promise<void>;
}

interface RoomEntry {
  key: string; // `${venueId}::${roomId}`
  venueId: string;
  venueName: string;
  room: RoomConfig;
}

const getShortVenueLabel = (venue: Venue): string => {
  if (venue.id === 'V02') return 'দয়াময়';
  if (venue.id === 'V03') return 'রাণীর বাজার';
  if (venue.id === 'V01') return 'তেতইগাঁও';
  return venue.name.split(' ')[0] || venue.id;
};

export const SeatPlanGenerator: React.FC<SeatPlanGeneratorProps> = ({
  venues,
  students,
  settings,
  seatPlans = [],
  onSaveSettings,
  onSaveVenue,
  onSaveSeatPlans
}) => {
  const hasV02AndV03 = venues.some(v => v.id === 'V02') && venues.some(v => v.id === 'V03');

  const [selectedVenueId, setSelectedVenueId] = useState<string>(() =>
    hasV02AndV03 ? COMBINED_V02_V03_ID : getPreferredExamVenueId(venues)
  );
  const [includeAllStudents, setIncludeAllStudents] = useState<boolean>(() => hasV02AndV03);
  const [activeRoomKey, setActiveRoomKey] = useState<string>('');
  const [printDocType, setPrintDocType] = useState<'door' | 'invigilator' | null>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  // Inline feedback banner (no window.alert)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => {
      setActionMessage(prev => (prev?.text === text ? null : prev));
    }, 5000);
  };

  // Dynamic Venue Rooms state so admin can add/edit/delete additional rooms
  const [venueRooms, setVenueRooms] = useState<Record<string, RoomConfig[]>>(() => {
    const map: Record<string, RoomConfig[]> = {};
    venues.forEach(v => {
      map[v.id] = [...(v.rooms || [])];
    });
    return map;
  });

  useEffect(() => {
    const map: Record<string, RoomConfig[]> = {};
    venues.forEach(v => {
      map[v.id] = [...(v.rooms || [])];
    });
    setVenueRooms(map);
    if (
      venues.length > 0 &&
      selectedVenueId !== COMBINED_V02_V03_ID &&
      !venues.some(v => v.id === selectedVenueId)
    ) {
      setSelectedVenueId(hasV02AndV03 ? COMBINED_V02_V03_ID : getPreferredExamVenueId(venues));
    }
  }, [venues, selectedVenueId, hasV02AndV03]);

  // Keep includeAllStudents defaulted smartly when switching mode
  const handleSelectMode = (nextMode: string) => {
    setSelectedVenueId(nextMode);
    if (nextMode === COMBINED_V02_V03_ID) {
      setIncludeAllStudents(true);
    } else {
      setIncludeAllStudents(false);
    }
  };

  // Target venues for the selected mode
  const targetVenues = useMemo<Venue[]>(() => {
    if (selectedVenueId === COMBINED_V02_V03_ID && hasV02AndV03) {
      const v02 = venues.find(v => v.id === 'V02')!;
      const v03 = venues.find(v => v.id === 'V03')!;
      return [v02, v03].map(v => ({
        ...v,
        rooms: venueRooms[v.id] || v.rooms || []
      }));
    }
    const single = venues.find(v => v.id === selectedVenueId) || venues[0];
    if (!single) return [];
    return [
      {
        ...single,
        rooms: venueRooms[single.id] || single.rooms || []
      }
    ];
  }, [selectedVenueId, hasV02AndV03, venues, venueRooms]);

  // Flat ordered list of rooms across target venues
  const roomEntries = useMemo<RoomEntry[]>(() => {
    const entries: RoomEntry[] = [];
    for (const v of targetVenues) {
      for (const r of v.rooms || []) {
        entries.push({
          key: `${v.id}::${r.id}`,
          venueId: v.id,
          venueName: v.name,
          room: r
        });
      }
    }
    return entries;
  }, [targetVenues]);

  // Hydrate displayed seatPlan from persisted `seatPlans` prop (or local optimistic override)
  const [localPlansOverride, setLocalPlansOverride] = useState<Record<string, SeatPlanResult> | null>(null);

  const activePlansMap = useMemo(() => {
    const map: Record<string, SeatPlanResult> = {};
    seatPlans.forEach(p => {
      map[p.venueId] = p;
    });
    if (localPlansOverride) {
      Object.entries(localPlansOverride).forEach(([k, v]) => {
        map[k] = v;
      });
    }
    return map;
  }, [seatPlans, localPlansOverride]);

  const seatPlan = useMemo<{
    combined: SeatPlanResult;
    byRoomKey: Record<string, SeatAssignment[]>;
    venueCounts: { venueId: string; venueName: string; count: number; capacity: number }[];
  } | null>(() => {
    if (targetVenues.length === 0) return null;

    const matchingSaved = targetVenues
      .map(v => activePlansMap[v.id])
      .filter((p): p is SeatPlanResult => Boolean(p && p.assignments));

    if (matchingSaved.length === 0) return null;

    const allAssignments: SeatAssignment[] = [];
    const byRoomKey: Record<string, SeatAssignment[]> = {};
    const venueCounts: { venueId: string; venueName: string; count: number; capacity: number }[] = [];

    let totalSeats = 0;
    let strictCount = 0;
    let relaxedCount = 0;
    let forcedCount = 0;
    let latestGeneratedAt = '';

    for (const v of targetVenues) {
      const saved = activePlansMap[v.id];
      const vCapacity = (v.rooms || []).reduce((acc, r) => acc + r.benches * r.perBench, 0);
      totalSeats += vCapacity;

      if (saved) {
        if (saved.generatedAt > latestGeneratedAt) latestGeneratedAt = saved.generatedAt;
        const vAssignments = saved.assignments.map(a => ({
          ...a,
          venueId: a.venueId || v.id,
          venueName: a.venueName || v.name
        }));
        allAssignments.push(...vAssignments);
        venueCounts.push({
          venueId: v.id,
          venueName: v.name,
          count: vAssignments.length,
          capacity: vCapacity
        });

        for (const a of vAssignments) {
          const rKey = `${v.id}::${a.roomId}`;
          if (!byRoomKey[rKey]) byRoomKey[rKey] = [];
          byRoomKey[rKey].push(a);
          if (a.mode === 'strict') strictCount++;
          else if (a.mode === 'relaxed') relaxedCount++;
          else forcedCount++;
        }
      } else {
        venueCounts.push({
          venueId: v.id,
          venueName: v.name,
          count: 0,
          capacity: vCapacity
        });
      }
    }

    const seatedCount = allAssignments.length;
    const strictPercentage = seatedCount > 0 ? Math.round((strictCount / seatedCount) * 100) : 100;

    return {
      combined: {
        venueId: targetVenues.map(v => v.id).join('+'),
        assignments: allAssignments,
        byRoom: byRoomKey,
        summary: {
          totalStudents: students.length,
          totalSeats,
          seatedCount,
          strictCount,
          relaxedCount,
          forcedCount,
          unseatedCount: Math.max(0, students.length - seatedCount),
          strictPercentage
        },
        generatedAt: latestGeneratedAt || new Date().toISOString()
      },
      byRoomKey,
      venueCounts
    };
  }, [targetVenues, activePlansMap, students.length]);

  useEffect(() => {
    if (roomEntries.length > 0 && !roomEntries.some(r => r.key === activeRoomKey)) {
      setActiveRoomKey(roomEntries[0].key);
    }
  }, [roomEntries, activeRoomKey]);

  // Modal for Room & Invigilator management
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editingRoomVenueId, setEditingRoomVenueId] = useState<string>('');
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomNameInput, setRoomNameInput] = useState('');
  const [roomBenchesInput, setRoomBenchesInput] = useState(15);
  const [teacher1Name, setTeacher1Name] = useState('');
  const [teacher1Phone, setTeacher1Phone] = useState('');
  const [teacher2Name, setTeacher2Name] = useState('');
  const [teacher2Phone, setTeacher2Phone] = useState('');

  // Teacher Switch Modal
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switchRoom1, setSwitchRoom1] = useState('');
  const [switchRoom2, setSwitchRoom2] = useState('');

  // Swap seats form
  const [swapId1, setSwapId1] = useState('');
  const [swapId2, setSwapId2] = useState('');
  const [swapError, setSwapError] = useState<string | null>(null);

  const eligibleStudents = useMemo(() => {
    if (includeAllStudents || selectedVenueId === COMBINED_V02_V03_ID) {
      return students;
    }
    const targetIds = new Set(targetVenues.map(v => v.id));
    return students.filter(s => targetIds.has(s.venueId));
  }, [students, includeAllStudents, selectedVenueId, targetVenues]);

  // Build updated Student[] with persisted room & actual venue metadata
  const applyAssignmentsToStudents = (assignments: SeatAssignment[]): Student[] => {
    const assignMap = new Map<string, SeatAssignment>();
    assignments.forEach(a => assignMap.set(a.studentId, a));

    const updated: Student[] = [];
    for (const st of students) {
      const a = assignMap.get(st.id);
      if (a) {
        updated.push({
          ...st,
          venueId: a.venueId,
          seatVenueId: a.venueId,
          seatVenueName: a.venueName,
          seatRoomId: a.roomId,
          seatRoomName: a.roomName,
          seatColumn: a.column,
          seatRow: a.row,
          seatPosition: a.position
        });
      }
    }
    return updated;
  };

  const persistPlans = async (plansToSave: SeatPlanResult[], allAssignments: SeatAssignment[]) => {
    const overrideMap: Record<string, SeatPlanResult> = {};
    plansToSave.forEach(p => {
      overrideMap[p.venueId] = p;
    });
    setLocalPlansOverride(prev => ({ ...(prev || {}), ...overrideMap }));

    if (onSaveSeatPlans) {
      setIsSavingPlan(true);
      try {
        const updatedStudents = applyAssignmentsToStudents(allAssignments);
        await onSaveSeatPlans(plansToSave, updatedStudents);
      } finally {
        setIsSavingPlan(false);
      }
    }
  };

  const handleGenerate = async (shuffle = false) => {
    if (targetVenues.length === 0) return;

    if (eligibleStudents.length === 0) {
      showFeedback('error', 'বিন্যস্ত করার জন্য কোনো শিক্ষার্থী পাওয়া যায়নি।');
      return;
    }

    let plansToSave: SeatPlanResult[] = [];
    let allAssignments: SeatAssignment[] = [];

    if (targetVenues.length > 1) {
      const multiRes = generateMultiVenueSeatPlan(eligibleStudents, targetVenues, shuffle);
      plansToSave = targetVenues.map(v => multiRes.byVenue[v.id]).filter(Boolean);
      allAssignments = multiRes.combined.assignments;
    } else {
      const singleVenue = targetVenues[0];
      const singleRes = generateSeatPlan(eligibleStudents, singleVenue, shuffle);
      plansToSave = [singleRes];
      allAssignments = singleRes.assignments;
    }

    if (roomEntries.length > 0) {
      setActiveRoomKey(roomEntries[0].key);
    }

    await persistPlans(plansToSave, allAssignments);

    const totalCapacity = targetVenues.reduce(
      (sum, v) => sum + (v.rooms || []).reduce((rSum, r) => rSum + r.benches * r.perBench, 0),
      0
    );
    const unseated = Math.max(0, eligibleStudents.length - allAssignments.length);
    const venueSummary = plansToSave
      .map(p => {
        const vObj = targetVenues.find(v => v.id === p.venueId);
        return `${vObj ? getShortVenueLabel(vObj) : p.venueId}: ${toBengaliDigits(p.assignments.length)} জন`;
      })
      .join(' | ');

    if (unseated > 0) {
      showFeedback(
        'error',
        `সতর্কতা: মোট আসন (${toBengaliDigits(totalCapacity)}) এর চেয়ে শিক্ষার্থী বেশি হওয়ায় ${toBengaliDigits(unseated)} জন আসন পাননি! আরও কক্ষ যুক্ত করুন। (${venueSummary})`
      );
    } else {
      showFeedback(
        'success',
        `সিট প্ল্যান সফলভাবে তৈরি ও ডাটাবেজে সংরক্ষিত হয়েছে! (${venueSummary})`
      );
    }
  };

  const handleTogglePublish = async () => {
    await onSaveSettings({
      ...settings,
      seatPlanPublished: !settings.seatPlanPublished
    });
  };

  const handleSwapSeats = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seatPlan) return;
    const id1 = swapId1.trim();
    const id2 = swapId2.trim();

    // Locate copies inside activePlansMap
    const updatedPlans: Record<string, SeatPlanResult> = {};
    targetVenues.forEach(v => {
      const existing = activePlansMap[v.id];
      if (existing) {
        updatedPlans[v.id] = {
          ...existing,
          assignments: existing.assignments.map(a => ({ ...a })),
          byRoom: { ...existing.byRoom }
        };
      }
    });

    let found1: { plan: SeatPlanResult; index: number; item: SeatAssignment } | null = null;
    let found2: { plan: SeatPlanResult; index: number; item: SeatAssignment } | null = null;

    for (const plan of Object.values(updatedPlans)) {
      const idx1 = plan.assignments.findIndex(a => a.studentId === id1);
      if (idx1 >= 0) found1 = { plan, index: idx1, item: plan.assignments[idx1] };
      const idx2 = plan.assignments.findIndex(a => a.studentId === id2);
      if (idx2 >= 0) found2 = { plan, index: idx2, item: plan.assignments[idx2] };
    }

    if (!found1 || !found2) {
      setSwapError('উভয় আইডিই বর্তমান সিট প্ল্যানে পাওয়া যায়নি');
      return;
    }

    const a1 = found1.item;
    const a2 = found2.item;

    // Swap physical seat coordinates (and venue if across V02 <-> V03)
    const seat1 = {
      venueId: a1.venueId,
      venueName: a1.venueName,
      roomId: a1.roomId,
      roomName: a1.roomName,
      column: a1.column,
      row: a1.row,
      position: a1.position
    };
    const seat2 = {
      venueId: a2.venueId,
      venueName: a2.venueName,
      roomId: a2.roomId,
      roomName: a2.roomName,
      column: a2.column,
      row: a2.row,
      position: a2.position
    };

    const swappedA1: SeatAssignment = { ...a1, ...seat2 };
    const swappedA2: SeatAssignment = { ...a2, ...seat1 };

    // Remove from old plans and place in destination venue plan
    found1.plan.assignments.splice(found1.index, 1);
    const reIdx2 = found2.plan.assignments.findIndex(a => a.studentId === id2);
    if (reIdx2 >= 0) found2.plan.assignments.splice(reIdx2, 1);

    updatedPlans[swappedA1.venueId]?.assignments.push(swappedA1);
    updatedPlans[swappedA2.venueId]?.assignments.push(swappedA2);

    // Rebuild byRoom and summary for touched plans
    const plansToSave = Object.values(updatedPlans).map(p => {
      const nextByRoom: Record<string, SeatAssignment[]> = {};
      p.assignments.forEach(a => {
        if (!nextByRoom[a.roomId]) nextByRoom[a.roomId] = [];
        nextByRoom[a.roomId].push(a);
      });
      return {
        ...p,
        byRoom: nextByRoom,
        generatedAt: new Date().toISOString()
      };
    });

    const allAssignments = plansToSave.flatMap(p => p.assignments);
    await persistPlans(plansToSave, allAssignments);

    setSwapId1('');
    setSwapId2('');
    setSwapError(null);
    showFeedback('success', `আইডি ${id1} এবং ${id2}-এর আসন সফলভাবে অদলবদল ও সংরক্ষণ করা হয়েছে!`);
  };

  // Open Room Modal to add or edit room + 2 teachers
  const handleOpenAddRoom = () => {
    const defaultVenue = targetVenues[0];
    if (!defaultVenue) return;
    setEditingRoomVenueId(defaultVenue.id);
    setEditingRoomId(null);
    const vRooms = venueRooms[defaultVenue.id] || defaultVenue.rooms || [];
    const nextRoomNum = vRooms.length + 1;
    setRoomNameInput(`কক্ষ ${nextRoomNum + (defaultVenue.id === 'V03' ? 200 : 100)}`);
    setRoomBenchesInput(14);
    setTeacher1Name('');
    setTeacher1Phone('');
    setTeacher2Name('');
    setTeacher2Phone('');
    setShowRoomModal(true);
  };

  const handleOpenEditRoom = (venueId: string, room: RoomConfig) => {
    setEditingRoomVenueId(venueId);
    setEditingRoomId(room.id);
    setRoomNameInput(room.name);
    setRoomBenchesInput(room.benches || 14);

    const invig = settings.invigilators?.find(i => i.roomId === room.id);
    if (invig) {
      setTeacher1Name(invig.teacher1Name || '');
      setTeacher1Phone(invig.teacher1Phone || '');
      setTeacher2Name(invig.teacher2Name || '');
      setTeacher2Phone(invig.teacher2Phone || '');
    } else {
      setTeacher1Name('');
      setTeacher1Phone('');
      setTeacher2Name('');
      setTeacher2Phone('');
    }
    setShowRoomModal(true);
  };

  // Save Room and Invigilators
  const handleSaveRoomAndTeachers = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRoomName = roomNameInput.trim();
    if (!cleanRoomName || !editingRoomVenueId) return;

    const targetVenue = venues.find(v => v.id === editingRoomVenueId);
    if (!targetVenue) return;

    const existingRooms = venueRooms[editingRoomVenueId] || targetVenue.rooms || [];
    const roomId = editingRoomId || `${editingRoomVenueId}-R${Date.now().toString().slice(-4)}`;
    const newRoomConfig: RoomConfig = {
      id: roomId,
      name: cleanRoomName,
      benches: roomBenchesInput || 14,
      perBench: 2
    };

    const updatedRooms = editingRoomId
      ? existingRooms.map(r => (r.id === editingRoomId ? newRoomConfig : r))
      : [...existingRooms, newRoomConfig];

    setVenueRooms(prev => ({
      ...prev,
      [editingRoomVenueId]: updatedRooms
    }));

    if (onSaveVenue) {
      await onSaveVenue({
        ...targetVenue,
        rooms: updatedRooms
      });
    }

    const currentInvigilators = settings.invigilators || [];
    const updatedEntry: RoomInvigilator = {
      roomId,
      roomName: cleanRoomName,
      teacher1Name: teacher1Name.trim(),
      teacher1Phone: teacher1Phone.trim(),
      teacher2Name: teacher2Name.trim(),
      teacher2Phone: teacher2Phone.trim()
    };

    const nextInvigList = currentInvigilators.filter(i => i.roomId !== roomId);
    nextInvigList.push(updatedEntry);

    await onSaveSettings({
      ...settings,
      invigilators: nextInvigList
    });

    setShowRoomModal(false);
    showFeedback('success', 'কক্ষ ও পরিদর্শক শিক্ষক সফলভাবে সংরক্ষিত হয়েছে!');
  };

  // Delete Room
  const handleDeleteRoom = async (venueId: string, roomId: string) => {
    if (!window.confirm('আপনি কি এই কক্ষটি মুছে ফেলতে চান?')) return;
    const targetVenue = venues.find(v => v.id === venueId);
    if (!targetVenue) return;

    const existingRooms = venueRooms[venueId] || targetVenue.rooms || [];
    const updatedRooms = existingRooms.filter(r => r.id !== roomId);
    setVenueRooms(prev => ({
      ...prev,
      [venueId]: updatedRooms
    }));

    if (onSaveVenue) {
      await onSaveVenue({
        ...targetVenue,
        rooms: updatedRooms
      });
    }

    const currentInvigilators = settings.invigilators || [];
    const nextInvigList = currentInvigilators.filter(i => i.roomId !== roomId);
    await onSaveSettings({
      ...settings,
      invigilators: nextInvigList
    });

    if (activeRoomKey === `${venueId}::${roomId}`) {
      const remaining = roomEntries.filter(entry => entry.key !== `${venueId}::${roomId}`);
      if (remaining.length > 0) setActiveRoomKey(remaining[0].key);
    }
    showFeedback('success', 'কক্ষটি সফলভাবে মুছে ফেলা হয়েছে।');
  };

  // Switch Teachers Between Two Rooms (works across V02 & V03 as well)
  const handleExecuteSwitchTeachers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!switchRoom1 || !switchRoom2 || switchRoom1 === switchRoom2) {
      showFeedback('error', 'অনুগ্রহ করে দুটি ভিন্ন কক্ষ নির্বাচন করুন।');
      return;
    }

    const currentInvigilators = settings.invigilators || [];
    const inv1 = currentInvigilators.find(i => i.roomId === switchRoom1);
    const inv2 = currentInvigilators.find(i => i.roomId === switchRoom2);

    const room1Obj = roomEntries.find(r => r.room.id === switchRoom1)?.room;
    const room2Obj = roomEntries.find(r => r.room.id === switchRoom2)?.room;

    const newInv1: RoomInvigilator = {
      roomId: switchRoom1,
      roomName: room1Obj?.name || switchRoom1,
      teacher1Name: inv2?.teacher1Name || '',
      teacher1Phone: inv2?.teacher1Phone || '',
      teacher2Name: inv2?.teacher2Name || '',
      teacher2Phone: inv2?.teacher2Phone || ''
    };

    const newInv2: RoomInvigilator = {
      roomId: switchRoom2,
      roomName: room2Obj?.name || switchRoom2,
      teacher1Name: inv1?.teacher1Name || '',
      teacher1Phone: inv1?.teacher1Phone || '',
      teacher2Name: inv1?.teacher2Name || '',
      teacher2Phone: inv1?.teacher2Phone || ''
    };

    const nextList = currentInvigilators.filter(i => i.roomId !== switchRoom1 && i.roomId !== switchRoom2);
    nextList.push(newInv1, newInv2);

    await onSaveSettings({
      ...settings,
      invigilators: nextList
    });

    setShowSwitchModal(false);
    showFeedback('success', 'দুই কক্ষের পরিদর্শক শিক্ষক সফলভাবে বদল করা হয়েছে!');
  };

  const activeRoomEntry = roomEntries.find(e => e.key === activeRoomKey) || roomEntries[0];
  const activeRoomAssignments = (activeRoomEntry && seatPlan?.byRoomKey[activeRoomEntry.key]) || [];
  const currentRoomInvigilator = activeRoomEntry
    ? settings.invigilators?.find(i => i.roomId === activeRoomEntry.room.id)
    : undefined;

  // Download printable document as standalone HTML file
  const handleDownloadDoc = (type: 'door' | 'invigilator') => {
    const docElement = document.getElementById('printable-seatplan-modal');
    if (!docElement || !activeRoomEntry) return;

    const title =
      type === 'door'
        ? `Door_List_${activeRoomEntry.venueName}_${activeRoomEntry.room.name}`
        : `Invigilator_Sheet_${activeRoomEntry.venueName}_${activeRoomEntry.room.name}`;

    const htmlContent = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: 'Hind Siliguri', 'SolaimanLipi', sans-serif; padding: 20px; color: #000; }
    h2, h3, h4 { margin: 4px 0; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
    th, td { border: 1px solid #333; padding: 6px 8px; }
    th { background: #f0f0f0; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .guard-box { border: 2px solid #000; padding: 10px; margin: 15px 0; background: #fafafa; }
    .sig-row { display: flex; justify-content: space-between; margin-top: 40px; }
    .sig-box { width: 30%; border-top: 1px solid #000; text-align: center; font-size: 12px; padding-top: 4px; }
  </style>
</head>
<body>
  ${docElement.innerHTML}
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 text-xs font-['Hind_Siliguri',sans-serif]">
      {/* Top Controller */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
              <Armchair className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>স্বয়ংক্রিয় সিট প্ল্যান জেনারেটর (Seat Plan & Persistence)</span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-gray-400 mt-0.5">
              দয়াময় সিংহ উচ্চ বিদ্যালয় (V02) ও রাণীর বাজার সরকারি প্রাথমিক বিদ্যালয় (V03)-এ ধারাবাহিকভাবে আসন বণ্টন করে শিক্ষার্থীদের আসন ও ভেন্যু তথ্য স্থায়ীভাবে সংরক্ষণ করে।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedVenueId}
              onChange={e => handleSelectMode(e.target.value)}
              className="px-3 py-2 border rounded-xl dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
            >
              {hasV02AndV03 && (
                <option value={COMBINED_V02_V03_ID}>
                  দয়াময় (V02) + রাণীর বাজার (V03) — সমন্বিত
                </option>
              )}
              {venues.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.id})
                </option>
              ))}
            </select>

            <button
              onClick={() => handleGenerate(false)}
              disabled={isSavingPlan}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold rounded-xl flex items-center gap-1.5 shadow-md transition disabled:opacity-60"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isSavingPlan ? 'সংরক্ষণ হচ্ছে...' : 'সিট প্ল্যান তৈরি ও সংরক্ষণ'}</span>
            </button>

            <button
              onClick={() => handleGenerate(true)}
              disabled={isSavingPlan}
              title="ভিন্ন বিন্যাস তৈরি করতে শাফল করুন"
              className="px-3 py-2 border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 font-extrabold rounded-xl flex items-center gap-1 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 disabled:opacity-60"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>শাফল</span>
            </button>
          </div>
        </div>

        {/* Eligible Students Filter Option */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-slate-700/60 text-[11px]">
          <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={includeAllStudents || selectedVenueId === COMBINED_V02_V03_ID}
              disabled={selectedVenueId === COMBINED_V02_V03_ID}
              onChange={e => setIncludeAllStudents(e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-600"
            />
            <span>
              সকল সক্রিয় শিক্ষার্থীকে অন্তর্ভুক্ত করুন ({toBengaliDigits(eligibleStudents.length)} জন পরীক্ষার্থী)
            </span>
          </label>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
            <Save className="w-3.5 h-3.5" />
            <span>সিট প্ল্যান তৈরি করলে স্বয়ংক্রিয়ভাবে ডাটাবেজে ও পাবলিক পোর্টালে সংরক্ষিত হয়</span>
          </span>
        </div>
      </div>

      {/* Inline Feedback Banner */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-xl border font-bold flex items-center justify-between gap-2 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-700 text-red-900 dark:text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Venue Breakdown Strip (shown in combined mode or when plan exists) */}
      {seatPlan && seatPlan.venueCounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {seatPlan.venueCounts.map(vc => (
            <div
              key={vc.venueId}
              className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl flex items-center justify-between"
            >
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 block">
                  {vc.venueId}
                </span>
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {vc.venueName}
                </span>
              </div>
              <div className="text-right">
                <span className="text-lg font-black font-mono text-indigo-700 dark:text-indigo-300">
                  {toBengaliDigits(vc.count)} / {toBengaliDigits(vc.capacity)}
                </span>
                <span className="block text-[10px] text-gray-500">বিন্যস্ত শিক্ষার্থী / আসন</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Room Exam Guard Teachers (Invigilators) Management Box */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-200 dark:border-slate-700 pb-3">
          <div>
            <h3 className="font-extrabold text-sm text-slate-950 dark:text-white flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>কক্ষভিত্তিক পরিদর্শক শিক্ষক ব্যবস্থাপনা (Room & Exam Guard Teachers)</span>
            </h3>
            <p className="text-[11px] text-gray-500">
              উভয় ভেন্যুর কক্ষসমূহ যুক্ত, সম্পাদনা এবং দুই কক্ষের শিক্ষক অদলবদল (Switch) করতে পারবেন।
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (roomEntries.length >= 2) {
                  setSwitchRoom1(roomEntries[0].room.id);
                  setSwitchRoom2(roomEntries[1].room.id);
                  setShowSwitchModal(true);
                } else {
                  showFeedback('error', 'শিক্ষক বদল করার জন্য কমপক্ষে ২টি কক্ষ থাকতে হবে।');
                }
              }}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center gap-1 transition"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" />
              <span>শিক্ষক অদলবদল (Switch)</span>
            </button>

            <button
              onClick={handleOpenAddRoom}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs flex items-center gap-1 shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>নতুন কক্ষ যুক্ত করুন</span>
            </button>
          </div>
        </div>

        {/* List of Assigned Rooms */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
          {roomEntries.map(entry => {
            const { room, venueId, venueName } = entry;
            const invig = settings.invigilators?.find(i => i.roomId === room.id);
            const venueObj = targetVenues.find(v => v.id === venueId);
            return (
              <div
                key={entry.key}
                className="p-3.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl space-y-2 shadow-xs"
              >
                <div className="flex justify-between items-start border-b border-gray-200 dark:border-slate-800 pb-1.5 gap-2">
                  <div>
                    <span className="font-extrabold text-indigo-700 dark:text-indigo-400 text-xs flex items-center gap-1">
                      <Building className="w-3.5 h-3.5 shrink-0" />
                      <span>{room.name}</span>
                      <span className="text-gray-500 font-normal">({room.benches} বেঞ্চ)</span>
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      {venueObj ? getShortVenueLabel(venueObj) : venueId} · {venueName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEditRoom(venueId, room)}
                      className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition"
                      title="কক্ষ ও শিক্ষক সম্পাদনা"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteRoom(venueId, room.id)}
                      className="p-1 text-slate-500 hover:text-red-600 hover:bg-white rounded-lg transition"
                      title="কক্ষ মুছুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {invig ? (
                  <div className="text-[11px] space-y-1 text-slate-800 dark:text-slate-200">
                    <div>
                      <strong className="text-slate-950 dark:text-white">১ম শিক্ষক:</strong> {invig.teacher1Name || 'নির্ধারিত নয়'}
                      {invig.teacher1Phone && <span className="font-mono text-gray-500"> ({invig.teacher1Phone})</span>}
                    </div>
                    <div>
                      <strong className="text-slate-950 dark:text-white">২য় শিক্ষক:</strong> {invig.teacher2Name || 'নির্ধারিত নয়'}
                      {invig.teacher2Phone && <span className="font-mono text-gray-500"> ({invig.teacher2Phone})</span>}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400 italic">
                    কোন পরিদর্শক শিক্ষক নিয়োগ দেওয়া হয়নি
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Overview & Publish Switch */}
      {seatPlan && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border">
            <span className="text-gray-500 text-[10px] block font-bold">মোট বিন্যস্ত শিক্ষার্থী / আসন</span>
            <span className="text-xl font-black text-slate-950 dark:text-white font-mono">
              {toBengaliDigits(seatPlan.combined.summary.seatedCount)} / {toBengaliDigits(seatPlan.combined.summary.totalSeats)}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-emerald-300">
            <span className="text-emerald-700 text-[10px] block font-bold">কঠোর নীতি (Strict Rule)</span>
            <span className="text-xl font-bold text-emerald-700 font-mono">
              {toBengaliDigits(seatPlan.combined.summary.strictCount)} ({seatPlan.combined.summary.strictPercentage}%)
            </span>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-amber-300">
            <span className="text-amber-700 text-[10px] block font-bold">শিথিল নীতি (Relaxed / Forced)</span>
            <span className="text-xl font-bold text-amber-700 font-mono">
              {toBengaliDigits(seatPlan.combined.summary.relaxedCount + seatPlan.combined.summary.forcedCount)}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-500 block font-bold">পাবলিক পোর্টালে আসন বিন্যাস</span>
              <span className={`font-bold ${settings.seatPlanPublished ? 'text-emerald-600' : 'text-gray-400'}`}>
                {settings.seatPlanPublished ? 'অনলাইনে উন্মুক্ত' : 'লকড / অপ্রকাশিত'}
              </span>
            </div>
            <button
              onClick={handleTogglePublish}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs ${
                settings.seatPlanPublished
                  ? 'bg-amber-600 text-white'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {settings.seatPlanPublished ? 'লক করুন' : 'উন্মুক্ত করুন'}
            </button>
          </div>
        </div>
      )}

      {/* Visual Bench Room Map */}
      {seatPlan && activeRoomEntry && (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
          {/* Room Selector & Print Outputs */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3">
            <div className="flex items-center gap-2 overflow-x-auto max-w-full">
              <span className="font-extrabold text-slate-800 dark:text-gray-200 shrink-0">কক্ষ নির্বাচন:</span>
              <div className="flex gap-1.5 overflow-x-auto">
                {roomEntries.map(entry => {
                  const venueObj = targetVenues.find(v => v.id === entry.venueId);
                  const roomCount = seatPlan.byRoomKey[entry.key]?.length || 0;
                  return (
                    <button
                      key={entry.key}
                      onClick={() => setActiveRoomKey(entry.key)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition whitespace-nowrap ${
                        activeRoomEntry.key === entry.key
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {venueObj ? `${getShortVenueLabel(venueObj)} · ` : ''}
                      {entry.room.name} ({toBengaliDigits(roomCount)})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Print Output Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setPrintDocType('door')}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
              >
                <FileText className="w-3.5 h-3.5 text-white" />
                <span className="text-white">দরজার তালিকা (Door List)</span>
              </button>
              <button
                onClick={() => setPrintDocType('invigilator')}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
              >
                <Printer className="w-3.5 h-3.5 text-white" />
                <span className="text-white">পরিদর্শক শীট (Invigilator Sheet)</span>
              </button>
            </div>
          </div>

          {/* Active Room Venue Header */}
          <div className="p-2.5 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-indigo-900 dark:text-indigo-200">
              প্রকৃত কেন্দ্র: {activeRoomEntry.venueName} ({activeRoomEntry.venueId}) · {activeRoomEntry.room.name}
            </span>
            <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
              মোট পরীক্ষার্থী: {toBengaliDigits(activeRoomAssignments.length)} জন
            </span>
          </div>

          {/* Room Invigilators Badge */}
          {currentRoomInvigilator && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
                <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>কক্ষ পরিদর্শক শিক্ষক:</strong> ১. {currentRoomInvigilator.teacher1Name || 'নির্ধারিত নয়'} {currentRoomInvigilator.teacher1Phone && `(${currentRoomInvigilator.teacher1Phone})`} | ২. {currentRoomInvigilator.teacher2Name || 'নির্ধারিত নয়'} {currentRoomInvigilator.teacher2Phone && `(${currentRoomInvigilator.teacher2Phone})`}
                </span>
              </div>
              <button
                onClick={() => handleOpenEditRoom(activeRoomEntry.venueId, activeRoomEntry.room)}
                className="text-emerald-700 dark:text-emerald-300 underline font-bold"
              >
                পরিবর্তন
              </button>
            </div>
          )}

          {/* Visual Bench Grid with Central Aisle */}
          <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl border overflow-x-auto">
            <div className="text-center pb-3 font-bold text-gray-500 uppercase tracking-widest text-[10px]">
              ↑ ব্ল্যাকবোর্ড / শিক্ষকের ডায়াস (Front of Room) ↑
            </div>

            <div className="grid grid-cols-2 gap-8 min-w-[500px]">
              {/* Left Column of Benches */}
              <div className="space-y-3">
                <span className="font-extrabold text-xs text-indigo-700 dark:text-indigo-400 block text-center mb-1">বাম সারি (Left Column)</span>
                {Array.from(new Set(activeRoomAssignments.filter(a => a.column === 'left').map(a => a.row))).sort((a, b) => a - b).map(row => {
                  const benchSeats = activeRoomAssignments.filter(a => a.column === 'left' && a.row === row).sort((a, b) => a.position - b.position);
                  return (
                    <div key={row} className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-300 dark:border-slate-700 shadow-xs flex items-center justify-around gap-2">
                      <span className="text-[10px] text-gray-400 font-mono font-bold w-10">বেঞ্চ {row}</span>
                      {benchSeats.map(s => (
                        <div
                          key={s.studentId}
                          className="flex-1 p-1.5 rounded-lg text-center border font-mono transition border-indigo-200 bg-indigo-50/50 text-indigo-900 dark:text-indigo-200"
                        >
                          <span className="block text-xs font-extrabold">{s.studentId}</span>
                          <span className="block text-[9px] opacity-75">শ্রেণি {toBengaliDigits(s.studentClass)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Right Column of Benches */}
              <div className="space-y-3 border-l-2 border-dashed border-gray-300 dark:border-slate-700 pl-4">
                <span className="font-extrabold text-xs text-indigo-700 dark:text-indigo-400 block text-center mb-1">ডান সারি (Right Column)</span>
                {Array.from(new Set(activeRoomAssignments.filter(a => a.column === 'right').map(a => a.row))).sort((a, b) => a - b).map(row => {
                  const benchSeats = activeRoomAssignments.filter(a => a.column === 'right' && a.row === row).sort((a, b) => a.position - b.position);
                  return (
                    <div key={row} className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-300 dark:border-slate-700 shadow-xs flex items-center justify-around gap-2">
                      <span className="text-[10px] text-gray-400 font-mono font-bold w-10">বেঞ্চ {row}</span>
                      {benchSeats.map(s => (
                        <div
                          key={s.studentId}
                          className="flex-1 p-1.5 rounded-lg text-center border font-mono transition border-indigo-200 bg-indigo-50/50 text-indigo-900 dark:text-indigo-200"
                        >
                          <span className="block text-xs font-extrabold">{s.studentId}</span>
                          <span className="block text-[9px] opacity-75">শ্রেণি {toBengaliDigits(s.studentClass)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-center pt-3 font-bold text-gray-400 uppercase tracking-widest text-[10px]">
              ↓ পেছনের দরজা ও খালি স্থান (Back of Room) ↓
            </div>
          </div>

          {/* Seat Swap Utility */}
          <form onSubmit={handleSwapSeats} className="p-3 bg-gray-50 dark:bg-slate-900 rounded-2xl border flex flex-wrap items-center gap-3">
            <span className="font-extrabold text-gray-800 dark:text-gray-200 flex items-center gap-1">
              <ArrowLeftRight className="w-4 h-4 text-indigo-600" />
              <span>আসন অদলবদল (Swap Two Seats):</span>
            </span>
            <input
              type="text"
              required
              placeholder="১ম রেজিস্ট্রেশন আইডি"
              value={swapId1}
              onChange={e => setSwapId1(e.target.value)}
              className="px-2.5 py-1.5 border rounded-lg dark:bg-slate-800 font-mono text-xs w-36 text-slate-900 dark:text-white"
            />
            <span>↔</span>
            <input
              type="text"
              required
              placeholder="২য় রেজিস্ট্রেশন আইডি"
              value={swapId2}
              onChange={e => setSwapId2(e.target.value)}
              className="px-2.5 py-1.5 border rounded-lg dark:bg-slate-800 font-mono text-xs w-36 text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs"
            >
              বদলান
            </button>
            {swapError && <span className="text-red-600 font-semibold">{swapError}</span>}
          </form>
        </div>
      )}

      {/* Add / Edit Room & 2 Teachers Modal */}
      {showRoomModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <Building className="w-5 h-5 text-indigo-600" />
                <span>{editingRoomId ? 'কক্ষ ও পরিদর্শক শিক্ষক সম্পাদনা' : 'নতুন কক্ষ ও পরিদর্শক শিক্ষক যুক্ত করুন'}</span>
              </h3>
              <button
                onClick={() => setShowRoomModal(false)}
                className="text-gray-500 hover:text-gray-800 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRoomAndTeachers} className="space-y-3.5 text-xs">
              {!editingRoomId && targetVenues.length > 1 && (
                <div>
                  <label className="block font-bold mb-1">কেন্দ্র / ভবন নির্বাচন *</label>
                  <select
                    value={editingRoomVenueId}
                    onChange={e => setEditingRoomVenueId(e.target.value)}
                    className="w-full p-2 border rounded-xl dark:bg-slate-800 font-semibold"
                  >
                    {targetVenues.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">কক্ষের নাম / নম্বর *</label>
                  <input
                    type="text"
                    required
                    value={roomNameInput}
                    onChange={e => setRoomNameInput(e.target.value)}
                    placeholder="যেমন: কক্ষ ১০৬ বা হল ২"
                    className="w-full p-2 border rounded-xl dark:bg-slate-800 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">মোট বেঞ্চ সংখ্যা *</label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    required
                    value={roomBenchesInput}
                    onChange={e => setRoomBenchesInput(parseInt(e.target.value, 10) || 14)}
                    className="w-full p-2 border rounded-xl dark:bg-slate-800 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Teacher 1 */}
              <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border space-y-2">
                <span className="font-extrabold text-indigo-600 dark:text-indigo-400 block">১ম পরিদর্শক শিক্ষক</span>
                <div>
                  <label className="block font-semibold mb-0.5">শিক্ষকের নাম *</label>
                  <input
                    type="text"
                    required
                    value={teacher1Name}
                    onChange={e => setTeacher1Name(e.target.value)}
                    placeholder="নাম লিখুন"
                    className="w-full p-2 border rounded-lg dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-0.5">মোবাইল নম্বর (ঐচ্ছিক)</label>
                  <input
                    type="tel"
                    value={teacher1Phone}
                    onChange={e => setTeacher1Phone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full p-2 border rounded-lg dark:bg-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Teacher 2 */}
              <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border space-y-2">
                <span className="font-extrabold text-indigo-600 dark:text-indigo-400 block">২য় পরিদর্শক শিক্ষক</span>
                <div>
                  <label className="block font-semibold mb-0.5">শিক্ষকের নাম *</label>
                  <input
                    type="text"
                    required
                    value={teacher2Name}
                    onChange={e => setTeacher2Name(e.target.value)}
                    placeholder="নাম লিখুন"
                    className="w-full p-2 border rounded-lg dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-0.5">মোবাইল নম্বর (ঐচ্ছিক)</label>
                  <input
                    type="tel"
                    value={teacher2Phone}
                    onChange={e => setTeacher2Phone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full p-2 border rounded-lg dark:bg-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRoomModal(false)}
                  className="px-4 py-2 border rounded-xl"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-md"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Switch Teachers Modal */}
      {showSwitchModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleExecuteSwitchTeachers} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
                <span>দুই কক্ষের শিক্ষক অদলবদল (Switch Teachers)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSwitchModal(false)}
                className="text-gray-500 hover:text-gray-800 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-gray-600 dark:text-gray-300">
              নিচে দুটি কক্ষ নির্বাচন করে এক ক্লিকে তাদের পরিদর্শক শিক্ষক অদলবদল করুন:
            </p>

            <div className="space-y-3">
              <div>
                <label className="block font-bold mb-1">১ম কক্ষ</label>
                <select
                  value={switchRoom1}
                  onChange={e => setSwitchRoom1(e.target.value)}
                  className="w-full p-2.5 border rounded-xl dark:bg-slate-800 font-semibold"
                >
                  {roomEntries.map(entry => {
                    const vObj = targetVenues.find(v => v.id === entry.venueId);
                    return (
                      <option key={entry.room.id} value={entry.room.id}>
                        {vObj ? `${getShortVenueLabel(vObj)} · ` : ''}
                        {entry.room.name} ({entry.room.id})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="text-center font-extrabold text-indigo-600">
                ↕️ অদলবদল ↕️
              </div>

              <div>
                <label className="block font-bold mb-1">২য় কক্ষ</label>
                <select
                  value={switchRoom2}
                  onChange={e => setSwitchRoom2(e.target.value)}
                  className="w-full p-2.5 border rounded-xl dark:bg-slate-800 font-semibold"
                >
                  {roomEntries.map(entry => {
                    const vObj = targetVenues.find(v => v.id === entry.venueId);
                    return (
                      <option key={entry.room.id} value={entry.room.id}>
                        {vObj ? `${getShortVenueLabel(vObj)} · ` : ''}
                        {entry.room.name} ({entry.room.id})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSwitchModal(false)}
                className="px-4 py-2 border rounded-xl"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-md"
              >
                বদল নিশ্চিত করুন
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Print / Download Document Modal View */}
      {printDocType && seatPlan && activeRoomEntry && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-gray-900 rounded-3xl max-w-3xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center pb-2 border-b print:hidden">
              <h3 className="font-bold text-base">
                {printDocType === 'door' ? 'কক্ষের দরজায় লাগানোর তালিকা (Door List)' : 'কক্ষ পরিদর্শক হাজিরা শীট (Invigilator Sheet)'}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadDoc(printDocType)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ডাউনলোড করুন (HTML)</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>প্রিন্ট করুন</span>
                </button>
                <button
                  onClick={() => setPrintDocType(null)}
                  className="text-gray-500 hover:text-gray-800 text-lg font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Document Sheet Content */}
            <div id="printable-seatplan-modal" className="space-y-4">
              <div className="text-center border-b pb-3">
                <h4 className="font-bold text-lg text-slate-900">{settings.contestNameBn}</h4>
                <p className="text-xs text-gray-600">{settings.organiserBn} · বার্ষিক গণিত প্রতিযোগিতা ২০২৬</p>
                <h3 className="text-base font-extrabold uppercase mt-1 text-indigo-900">
                  {printDocType === 'door' ? 'কক্ষের দরজার তালিকা (DOOR SEAT PLAN)' : 'কক্ষ পরিদর্শক হাজিরা ও স্বাক্ষর শীট (INVIGILATOR ATTENDANCE SHEET)'}
                </h3>
                <p className="text-xs font-bold text-gray-800 mt-0.5">
                  কেন্দ্র: {activeRoomEntry.venueName} · কক্ষ: {activeRoomEntry.room.name}
                </p>
              </div>

              {/* Guard Teachers Section */}
              <div className="p-3 bg-gray-50 border border-gray-400 rounded-xl text-xs flex justify-between items-center">
                <div>
                  <span className="font-bold block text-slate-900">কক্ষ পরিদর্শক শিক্ষকবৃন্দ:</span>
                  <span className="text-gray-800">
                    ১. {currentRoomInvigilator?.teacher1Name || '___________________________'} {currentRoomInvigilator?.teacher1Phone && `(${currentRoomInvigilator.teacher1Phone})`}
                  </span>
                  <span className="mx-2 text-gray-400">|</span>
                  <span className="text-gray-800">
                    ২. {currentRoomInvigilator?.teacher2Name || '___________________________'} {currentRoomInvigilator?.teacher2Phone && `(${currentRoomInvigilator.teacher2Phone})`}
                  </span>
                </div>
                <div className="text-right font-mono font-bold text-gray-600">
                  মোট পরীক্ষার্থী: {toBengaliDigits(activeRoomAssignments.length)} জন
                </div>
              </div>

              {/* Table of Students */}
              <table className="w-full text-left text-xs border border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border text-center w-12">ক্রম</th>
                    <th className="p-2 border">রেজিস্ট্রেশন আইডি</th>
                    <th className="p-2 border">শিক্ষার্থীর নাম</th>
                    <th className="p-2 border text-center">শ্রেণি</th>
                    <th className="p-2 border">বিদ্যালয়ের নাম</th>
                    <th className="p-2 border text-center">বরাদ্দকৃত আসন</th>
                    {printDocType === 'invigilator' && <th className="p-2 border text-center w-28">শিক্ষার্থীর স্বাক্ষর</th>}
                  </tr>
                </thead>
                <tbody>
                  {activeRoomAssignments.map((s, idx) => (
                    <tr key={s.studentId} className="border-b">
                      <td className="p-2 border text-center font-mono">{idx + 1}</td>
                      <td className="p-2 border font-mono font-bold text-slate-900">{s.studentId}</td>
                      <td className="p-2 border font-medium text-slate-900">{s.studentName}</td>
                      <td className="p-2 border text-center font-mono">{toBengaliDigits(s.studentClass)}</td>
                      <td className="p-2 border text-gray-700">{s.schoolName || '—'}</td>
                      <td className="p-2 border text-center font-mono font-semibold">
                        {s.column === 'left' ? 'বাম' : 'ডান'} বেঞ্চ-{s.row} (আসন-{s.position})
                      </td>
                      {printDocType === 'invigilator' && <td className="p-2 border h-8"></td>}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Signatures Footer */}
              {printDocType === 'invigilator' && (
                <div className="pt-8 grid grid-cols-3 text-center text-xs text-gray-700 mt-6">
                  <div>
                    <div className="w-36 border-b border-gray-600 mx-auto mb-1"></div>
                    <span className="font-bold">১ম পরিদর্শকের স্বাক্ষর</span>
                  </div>
                  <div>
                    <div className="w-36 border-b border-gray-600 mx-auto mb-1"></div>
                    <span className="font-bold">২য় পরিদর্শকের স্বাক্ষর</span>
                  </div>
                  <div>
                    <div className="w-36 border-b border-gray-600 mx-auto mb-1"></div>
                    <span className="font-bold">কেন্দ্র সচিবের স্বাক্ষর</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
