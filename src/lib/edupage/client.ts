import dns from 'node:dns';

// Ensure IPv4 lookup priority on environments where IPv6 isn't globally routable
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignored if unsupported
}

const BASE_URL = 'https://iilmgn.edupage.org';
const USER_AGENT = 'Khaali/1.0 (IILM University SoCSE Classroom Vacancy Finder; contact: engineering)';

let cachedCookie: string | null = null;
let lastKnownGoodPayload: unknown | null = null;
let lastKnownGoodTimestamp: number | null = null;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function obtainSessionCookie(): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${BASE_URL}/timetable/`, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT
      },
      signal: controller.signal
    });

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/PHPSESSID=[^;]+/);
      if (match) {
        cachedCookie = match[0];
        return cachedCookie;
      }
    }
    return '';
  } finally {
    clearTimeout(timeoutId);
  }
}

async function rpcPost<T>(
  modulePath: string,
  funcName: string,
  args: unknown[],
  attempt = 1
): Promise<T> {
  if (!cachedCookie) {
    await obtainSessionCookie();
  }

  const url = `${BASE_URL}${modulePath}?__func=${encodeURIComponent(funcName)}`;
  const body = JSON.stringify({
    __args: args,
    __gsh: '00000000'
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Referer': `${BASE_URL}/timetable/`,
        'User-Agent': USER_AGENT,
        ...(cachedCookie ? { 'Cookie': cachedCookie } : {})
      },
      body,
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const json = (await res.json()) as { reload?: boolean };

    // If session expired or reload triggered, refresh cookie once and retry
    if (json && json.reload) {
      if (attempt === 1) {
        console.warn(`EduPage returned reload:true on ${funcName}. Refreshing session cookie and retrying...`);
        cachedCookie = null;
        await sleep(1000);
        return rpcPost<T>(modulePath, funcName, args, attempt + 1);
      }
      throw new Error(`EduPage requested reload on ${funcName} after session refresh`);
    }

    return json as T;
  } catch (err) {
    if (attempt === 1) {
      console.warn(`Upstream call to ${funcName} failed (attempt 1). Backing off 1s and retrying...`, err);
      await sleep(1000);
      return rpcPost<T>(modulePath, funcName, args, attempt + 1);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface TimetableMetadata {
  ttId: string;
  name: string;
  year?: number;
  dateFrom?: string;
  validityWindow?: {
    startDate: string;
    endDate: string;
  };
}

export async function fetchTTViewer(): Promise<{
  defaultTtId: string;
  timetables: Array<{ tt_num: string; year?: number; text: string; datefrom?: string; hidden?: boolean }>;
}> {
  const currentYear = new Date().getFullYear();
  const res = await rpcPost<{
    r?: {
      regular?: {
        default_num?: string;
        timetables?: Array<{ tt_num: string; year?: number; text: string; datefrom?: string; hidden?: boolean }>;
      };
    };
  }>('/timetable/server/ttviewer.js', 'getTTViewerData', [null, currentYear]);

  const regular = res.r?.regular;
  const timetables = regular?.timetables || [];
  const defaultTtId = regular?.default_num || (timetables.length > 0 ? timetables[timetables.length - 1].tt_num : '37');

  return { defaultTtId, timetables };
}

export async function fetchRawTimetable(ttId?: string): Promise<{
  data: unknown;
  metadata: TimetableMetadata;
  fromFallback: boolean;
  fetchedAt: number;
}> {
  try {
    let activeTtId = ttId;
    let activeName = '';
    let dateFrom = '';

    const viewer = await fetchTTViewer();
    if (!activeTtId) {
      activeTtId = viewer.defaultTtId;
    }

    const matched = viewer.timetables.find(t => t.tt_num === activeTtId);
    activeName = matched?.text || `Timetable ${activeTtId}`;
    dateFrom = matched?.datefrom || '';

    // Extract date range from text e.g. "IILM_GN_SCSE_Odd_2026-2027 (17/8/2026 - 31/1/2027)"
    let validityWindow: { startDate: string; endDate: string } | undefined;
    const matchDates = activeName.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (matchDates) {
      validityWindow = {
        startDate: matchDates[1],
        endDate: matchDates[2]
      };
    }

    const rawData = await rpcPost<unknown>(
      '/timetable/server/regulartt.js',
      'regularttGetData',
      [null, activeTtId]
    );

    const now = Date.now();
    lastKnownGoodPayload = rawData;
    lastKnownGoodTimestamp = now;

    return {
      data: rawData,
      metadata: {
        ttId: activeTtId,
        name: activeName,
        dateFrom,
        validityWindow
      },
      fromFallback: false,
      fetchedAt: now
    };
  } catch (err) {
    console.error('Failed to fetch upstream timetable:', err);
    if (lastKnownGoodPayload) {
      return {
        data: lastKnownGoodPayload,
        metadata: {
          ttId: ttId || '37',
          name: 'Last Known Good Timetable',
          validityWindow: { startDate: '17/8/2026', endDate: '31/1/2027' }
        },
        fromFallback: true,
        fetchedAt: lastKnownGoodTimestamp || Date.now()
      };
    }
    throw err;
  }
}
