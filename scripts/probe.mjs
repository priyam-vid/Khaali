import dns from 'node:dns';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dns.setDefaultResultOrder('ipv4first');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const BASE_URL = 'https://iilmgn.edupage.org';

async function main() {
  console.log('--- 1. Probing EduPage Timetable ---');
  
  // Step 1: GET /timetable/ to obtain session cookie
  console.log('Visiting /timetable/ to obtain session cookie...');
  const initRes = await fetch(`${BASE_URL}/timetable/`, {
    headers: {
      'User-Agent': 'Khaali/1.0 (https://github.com)'
    }
  });

  const setCookie = initRes.headers.get('set-cookie');
  let cookieHeader = '';
  if (setCookie) {
    const match = setCookie.match(/PHPSESSID=[^;]+/);
    if (match) {
      cookieHeader = match[0];
      console.log('Obtained session cookie:', cookieHeader);
    }
  }

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Referer': `${BASE_URL}/timetable/`,
    'User-Agent': 'Khaali/1.0 (https://github.com)',
    ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
  };

  // Step 2: Call getTTViewerData
  console.log('Calling getTTViewerData...');
  const viewerRes = await fetch(`${BASE_URL}/timetable/server/ttviewer.js?__func=getTTViewerData`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      __args: [null, 2026],
      __gsh: '00000000'
    })
  });

  const viewerData = await viewerRes.json();
  if (viewerData.reload) {
    throw new Error('getTTViewerData returned { reload: true }. Cookie session may have failed.');
  }

  const timetables = viewerData?.r?.regular?.timetables || [];
  const defaultNum = viewerData?.r?.regular?.default_num;
  console.log('\nAvailable timetables:');
  for (const tt of timetables) {
    console.log(`  - [ID: ${tt.tt_num}] (Year: ${tt.year}) ${tt.text} (datefrom: ${tt.datefrom}, hidden: ${tt.hidden})`);
  }
  console.log(`Default timetable ID: ${defaultNum}`);

  const activeTt = timetables.find(t => t.tt_num === defaultNum) || timetables[timetables.length - 1];
  const ttId = activeTt?.tt_num || defaultNum || '37';
  console.log(`Selected timetable ID: ${ttId} ("${activeTt?.text}")\n`);

  // Step 3: Call regularttGetData
  console.log(`Calling regularttGetData with ttId: ${ttId}...`);
  const regularRes = await fetch(`${BASE_URL}/timetable/server/regulartt.js?__func=regularttGetData`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      __args: [null, ttId],
      __gsh: '00000000'
    })
  });

  const rawJson = await regularRes.json();
  if (rawJson.reload) {
    throw new Error('regularttGetData returned { reload: true }');
  }

  // Step 4: Write to fixtures/regulartt.raw.json
  const fixturesDir = path.join(ROOT_DIR, 'fixtures');
  await fs.mkdir(fixturesDir, { recursive: true });
  const fixturePath = path.join(fixturesDir, 'regulartt.raw.json');
  await fs.writeFile(fixturePath, JSON.stringify(rawJson, null, 2), 'utf-8');
  console.log(`Saved raw timetable to ${fixturePath} (${(Buffer.byteLength(JSON.stringify(rawJson)) / 1024).toFixed(1)} KB)`);

  // Step 5: Print table schemas and first 2 rows
  const tables = rawJson?.r?.dbiAccessorRes?.tables || [];
  console.log(`\nFound ${tables.length} tables in r.dbiAccessorRes.tables[]:`);
  for (const table of tables) {
    console.log('\n========================================');
    console.log(`TABLE: "${table.id}"`);
    console.log(`Columns (${(table.columns || table.data_columns || []).length}):`, (table.columns || table.data_columns || []).join(', '));
    console.log(`Total rows: ${(table.data_rows || []).length}`);
    const firstTwo = (table.data_rows || []).slice(0, 2);
    console.log('First 2 data_rows:', JSON.stringify(firstTwo, null, 2));
  }

  console.log('\n--- Probe Complete ---');
}

main().catch(err => {
  console.error('Probe failed:', err);
  process.exit(1);
});
