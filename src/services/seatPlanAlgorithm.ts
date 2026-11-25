import { Student, Venue, RoomConfig } from '../types';

export interface SeatAssignment {
  studentId: string;
  studentName: string;
  studentClass: number;
  schoolName: string;
  venueId: string;
  venueName: string;
  roomName: string;
  roomId: string;
  column: 'left' | 'right';
  row: number; // 1-indexed
  position: number; // 1..perBench
  mode: 'strict' | 'relaxed' | 'forced';
}

export interface SeatPlanSummary {
  totalStudents: number;
  totalSeats: number;
  seatedCount: number;
  strictCount: number;
  relaxedCount: number;
  forcedCount: number;
  unseatedCount: number;
  strictPercentage: number;
}

export interface SeatPlanResult {
  venueId: string;
  assignments: SeatAssignment[];
  byRoom: Record<string, SeatAssignment[]>;
  summary: SeatPlanSummary;
  generatedAt: string;
}

export interface MultiVenueSeatPlanResult {
  combined: SeatPlanResult;
  byVenue: Record<string, SeatPlanResult>;
}

/**
 * Executes the greedy deterministic seat plan algorithm across one or more ordered venues.
 *
 * Rules in order of priority:
 * 1. Strict: No neighbour (left, right, front, back) has the same class.
 * 2. Relaxed: No one on the same bench has the same class.
 * 3. Forced: Take any student; mark as rule break.
 */
export function generateMultiVenueSeatPlan(
  students: Student[],
  venues: Venue[],
  shuffle = false
): MultiVenueSeatPlanResult {
  const classQueues = new Map<number, Student[]>();

  students.forEach(s => {
    if (!classQueues.has(s.class)) {
      classQueues.set(s.class, []);
    }
    classQueues.get(s.class)!.push(s);
  });

  classQueues.forEach(q => {
    if (shuffle) {
      q.sort(() => Math.random() - 0.5);
    } else {
      q.sort((a, b) => a.id.localeCompare(b.id));
    }
  });

  const combinedAssignments: SeatAssignment[] = [];
  const combinedByRoom: Record<string, SeatAssignment[]> = {};
  const roomGrid: Record<string, Record<'left' | 'right', Record<number, Record<number, number>>>> = {};

  let totalSeats = 0;
  let strictCount = 0;
  let relaxedCount = 0;
  let forcedCount = 0;

  const byVenue: Record<string, SeatPlanResult> = {};
  const generatedAt = new Date().toISOString();

  for (const venue of venues) {
    const venueAssignments: SeatAssignment[] = [];
    const venueByRoom: Record<string, SeatAssignment[]> = {};
    let venueSeats = 0;
    let venueStrict = 0;
    let venueRelaxed = 0;
    let venueForced = 0;

    const rooms: RoomConfig[] =
      venue.rooms && venue.rooms.length > 0
        ? venue.rooms
        : [{ id: `${venue.id}-R101`, name: 'কক্ষ ১০১', benches: 20, perBench: 2 }];

    for (const room of rooms) {
      const gridKey = `${venue.id}::${room.id}`;
      venueByRoom[room.id] = [];
      combinedByRoom[gridKey] = [];
      roomGrid[gridKey] = { left: {}, right: {} };

      const rowsPerCol = Math.ceil(room.benches / 2);
      const K = room.perBench;
      const roomSeatCap = room.benches * K;
      totalSeats += roomSeatCap;
      venueSeats += roomSeatCap;

      for (let row = 1; row <= rowsPerCol; row++) {
        for (const col of ['left', 'right'] as const) {
          if (room.benches % 2 !== 0 && row === rowsPerCol && col === 'right') {
            continue;
          }

          if (!roomGrid[gridKey][col][row]) {
            roomGrid[gridKey][col][row] = {};
          }

          for (let pos = 1; pos <= K; pos++) {
            const activeClasses = Array.from(classQueues.entries())
              .filter(([_, q]) => q.length > 0)
              .sort((a, b) => b[1].length - a[1].length);

            if (activeClasses.length === 0) {
              break;
            }

            const leftNeighbourClass = roomGrid[gridKey][col][row]?.[pos - 1];
            const frontNeighbourClass = roomGrid[gridKey][col][row - 1]?.[pos];
            const benchClasses = Object.values(roomGrid[gridKey][col][row] || {});

            let chosenClass: number | null = null;
            let mode: 'strict' | 'relaxed' | 'forced' = 'strict';

            for (const [cls] of activeClasses) {
              if (cls !== leftNeighbourClass && cls !== frontNeighbourClass) {
                chosenClass = cls;
                mode = 'strict';
                break;
              }
            }

            if (chosenClass === null) {
              for (const [cls] of activeClasses) {
                if (!benchClasses.includes(cls)) {
                  chosenClass = cls;
                  mode = 'relaxed';
                  break;
                }
              }
            }

            if (chosenClass === null) {
              chosenClass = activeClasses[0][0];
              mode = 'forced';
            }

            const queue = classQueues.get(chosenClass)!;
            const student = queue.shift()!;

            roomGrid[gridKey][col][row][pos] = chosenClass;

            const assignment: SeatAssignment = {
              studentId: student.id,
              studentName: student.nameBn || student.nameEn,
              studentClass: student.class,
              schoolName: student.schoolName,
              venueId: venue.id,
              venueName: venue.name,
              roomName: room.name,
              roomId: room.id,
              column: col,
              row,
              position: pos,
              mode
            };

            combinedAssignments.push(assignment);
            venueAssignments.push(assignment);
            combinedByRoom[gridKey].push(assignment);
            venueByRoom[room.id].push(assignment);

            if (mode === 'strict') {
              strictCount++;
              venueStrict++;
            } else if (mode === 'relaxed') {
              relaxedCount++;
              venueRelaxed++;
            } else {
              forcedCount++;
              venueForced++;
            }
          }
        }
      }
    }

    const vSeated = venueAssignments.length;
    byVenue[venue.id] = {
      venueId: venue.id,
      assignments: venueAssignments,
      byRoom: venueByRoom,
      summary: {
        totalStudents: vSeated,
        totalSeats: venueSeats,
        seatedCount: vSeated,
        strictCount: venueStrict,
        relaxedCount: venueRelaxed,
        forcedCount: venueForced,
        unseatedCount: 0,
        strictPercentage: vSeated > 0 ? Math.round((venueStrict / vSeated) * 100) : 100
      },
      generatedAt
    };
  }

  const unseatedCount = Array.from(classQueues.values()).reduce((sum, q) => sum + q.length, 0);
  const seatedCount = combinedAssignments.length;
  const strictPercentage = seatedCount > 0 ? Math.round((strictCount / seatedCount) * 100) : 100;

  return {
    combined: {
      venueId: venues.map(v => v.id).join('+'),
      assignments: combinedAssignments,
      byRoom: combinedByRoom,
      summary: {
        totalStudents: students.length,
        totalSeats,
        seatedCount,
        strictCount,
        relaxedCount,
        forcedCount,
        unseatedCount,
        strictPercentage
      },
      generatedAt
    },
    byVenue
  };
}

/**
 * Single-venue seat plan generator (preserves legacy signature).
 */
export function generateSeatPlan(
  students: Student[],
  venue: Venue,
  shuffle = false
): SeatPlanResult {
  const res = generateMultiVenueSeatPlan(students, [venue], shuffle);
  const vPlan = res.byVenue[venue.id];
  return {
    venueId: venue.id,
    assignments: vPlan?.assignments || [],
    byRoom: vPlan?.byRoom || {},
    summary: {
      ...res.combined.summary,
      totalStudents: students.length
    },
    generatedAt: res.combined.generatedAt
  };
}
