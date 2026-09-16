import { DayIndex, Occupancy, Room } from '../domain/rooms';
import { getISTTimeInfo } from '../domain/time';

export interface SubstitutionChange {
  date: string;
  period: number;
  batchName?: string;
  subjectName?: string;
  originalRoomName?: string;
  newRoomName?: string;
  type: 'cancelled' | 'room_swap' | 'relief_teacher' | 'other';
  rawText: string;
}

const BASE_URL = 'https://iilmgn.edupage.org';
const USER_AGENT = 'Khaali/1.0 (IILM University SoCSE Classroom Vacancy Finder; contact: engineering)';

let cachedSubstCookie: string | null = null;
let lastKnownGoodSubst: SubstitutionChange[] = [];
let lastSubstFetchedAt: number | null = null;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function obtainSubstCookie(): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${BASE_URL}/substitution/`, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal
    });

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/PHPSESSID=[^;]+/);
      if (match) {
        cachedSubstCookie = match[0];
        return cachedSubstCookie;
      }
    }
    return '';
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parses raw HTML report from getSubstViewerDayDataHtml into structured changes.
 */
export function parseSubstitutionHtml(html: string, date: string): SubstitutionChange[] {
  if (!html || html.includes('There is no substitution defined for this day.')) {
    return [];
  }

  const changes: SubstitutionChange[] = [];

  // Matches row elements: <div class="row ..."><div class="period"><span>(\d+)</span></div><div class="info">...</div></div>
  const rowRegex = /<div\s+class="row(?:\s+[^"]*)?">([\s\S]*?)<\/div>\s*<\/div>/gi;
  let match: RegExpExecArray | null;

  while ((match = rowRegex.exec(html)) !== null) {
    const rowInner = match[1];
    if (rowInner.includes('nosubst')) continue;

    // Extract period
    const periodMatch = rowInner.match(/<div\s+class="period"[^>]*>[\s\S]*?<span[^>]*>\s*(\d+)\s*<\/span>/i);
    const period = periodMatch ? parseInt(periodMatch[1], 10) : 0;
    if (!period) continue;

    // Extract text content from info
    const infoMatch = rowInner.match(/<div\s+class="info"[^>]*>([\s\S]*)$/i);
    const infoHtml = infoMatch ? infoMatch[1] : rowInner;
    const cleanText = infoHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    let type: SubstitutionChange['type'] = 'other';
    let originalRoomName: string | undefined;
    let newRoomName: string | undefined;

    // Check cancellation
    if (/cancell?ed|no class/i.test(cleanText)) {
      type = 'cancelled';
    }

    // Check room change: e.g. "room changed to EB 305" or "EB 201 -> EB 305"
    const roomChangeMatch = cleanText.match(/room\s+(?:changed\s+to|->|to)\s+([A-Za-z0-9\s]+)/i);
    if (roomChangeMatch) {
      type = 'room_swap';
      newRoomName = roomChangeMatch[1].trim();
    }

    changes.push({
      date,
      period,
      type,
      originalRoomName,
      newRoomName,
      rawText: cleanText
    });
  }

  return changes;
}

/**
 * Fetches today's substitutions from EduPage with retry, timeout, and fallback.
 */
export async function fetchSubstitutions(dateStr?: string): Promise<{
  changes: SubstitutionChange[];
  date: string;
  fromFallback: boolean;
  fetchedAt: number;
}> {
  const ist = getISTTimeInfo();
  const targetDate = dateStr || ist.dateString;

  try {
    if (!cachedSubstCookie) {
      await obtainSubstCookie();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const url = `${BASE_URL}/substitution/server/viewer.js?__func=getSubstViewerDayDataHtml`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Referer': `${BASE_URL}/substitution/`,
        'User-Agent': USER_AGENT,
        ...(cachedSubstCookie ? { 'Cookie': cachedSubstCookie } : {})
      },
      body: JSON.stringify({
        __args: [null, { date: targetDate, mode: 'classes' }],
        __gsh: '00000000'
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const json = (await res.json()) as { r?: string };
    const html = json.r || '';
    const changes = parseSubstitutionHtml(html, targetDate);

    lastKnownGoodSubst = changes;
    lastSubstFetchedAt = Date.now();

    return {
      changes,
      date: targetDate,
      fromFallback: false,
      fetchedAt: lastSubstFetchedAt
    };
  } catch (err) {
    console.warn(`Upstream substitution fetch failed:`, err);
    return {
      changes: lastKnownGoodSubst,
      date: targetDate,
      fromFallback: true,
      fetchedAt: lastSubstFetchedAt || Date.now()
    };
  }
}

/**
 * Merges substitution changes into base occupancies.
 * - Cancellations: removes occupancy
 * - Room swaps: updates occupancy room
 */
export function applySubstitutions(
  baseOccupancies: Occupancy[],
  substitutions: SubstitutionChange[],
  rooms: Room[],
  day: DayIndex
): Occupancy[] {
  if (!substitutions || substitutions.length === 0) {
    return baseOccupancies;
  }

  const roomNameMap = new Map<string, string>();
  for (const r of rooms) {
    roomNameMap.set(r.name.toLowerCase().trim(), r.id);
  }

  const cancelledSlots = new Set<string>();
  const swaps: Array<{ period: number; fromRoomId?: string; toRoomId: string; raw: SubstitutionChange }> = [];

  for (const sub of substitutions) {
    if (sub.type === 'cancelled') {
      if (sub.originalRoomName) {
        const rId = roomNameMap.get(sub.originalRoomName.toLowerCase().trim());
        if (rId) cancelledSlots.add(`${sub.period}:${rId}`);
      }
    } else if (sub.type === 'room_swap' && sub.newRoomName) {
      const toId = roomNameMap.get(sub.newRoomName.toLowerCase().trim());
      if (toId) {
        const fromId = sub.originalRoomName
          ? roomNameMap.get(sub.originalRoomName.toLowerCase().trim())
          : undefined;
        swaps.push({ period: sub.period, fromRoomId: fromId, toRoomId: toId, raw: sub });
      }
    }
  }

  // Filter out cancellations
  let result = baseOccupancies.filter(occ => {
    if (occ.day === day && cancelledSlots.has(`${occ.period}:${occ.roomId}`)) {
      return false; // Removed due to cancellation
    }
    return true;
  });

  // Apply swaps
  for (const swap of swaps) {
    if (swap.fromRoomId) {
      // Find matching occupancy to reassign
      const found = result.find(o => o.day === day && o.period === swap.period && o.roomId === swap.fromRoomId);
      if (found) {
        found.roomId = swap.toRoomId;
        found.source = 'substitution';
      }
    } else {
      // Inject occupied block for new room
      result.push({
        roomId: swap.toRoomId,
        day,
        period: swap.period,
        subjectCode: 'SUBST',
        subjectName: swap.raw.rawText || 'Reassigned Class',
        teacherNames: [],
        batchNames: swap.raw.batchName ? [swap.raw.batchName] : [],
        source: 'substitution'
      });
    }
  }

  return result;
}
