import fs from 'node:fs/promises';

async function run() {
  const raw = JSON.parse(await fs.readFile('fixtures/regulartt.raw.json', 'utf8'));
  const classrooms = raw.r.dbiAccessorRes.tables.find(x => x.id === 'classrooms').data_rows;
  const cards = raw.r.dbiAccessorRes.tables.find(x => x.id === 'cards').data_rows;
  
  const roomCardCounts = new Map();
  for (const c of cards) {
    for (const rid of (c.classroomids || [])) {
      roomCardCounts.set(rid, (roomCardCounts.get(rid) || 0) + 1);
    }
  }

  function deriveBuilding(name) {
    if (/Law Block|LAW/i.test(name)) return 'LAW';
    if (/SVH/i.test(name)) return 'SVH';
    if (/Foundation Block|FB/i.test(name)) return 'FB';
    if (/EB/i.test(name)) return 'EB';
    return 'OTHER';
  }

  function deriveFloor(name) {
    const match = name.match(/\b([1-9])\d{2}\b/);
    return match ? parseInt(match[1], 10) : null;
  }

  function isLab(name) {
    return /\blab\b/i.test(name);
  }

  const results = classrooms.map(r => {
    const cardCount = roomCardCounts.get(r.id) || 0;
    return {
      id: r.id,
      name: r.name,
      short: r.short,
      building: deriveBuilding(r.name),
      floor: deriveFloor(r.name),
      isLab: isLab(r.name),
      cards: cardCount,
      neverScheduled: cardCount === 0
    };
  });

  console.log('\n--- ALL ROOMS CLASSIFICATION (' + results.length + ' rooms) ---');
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    console.log(
      String(i + 1).padStart(3) + ' | ' +
      r.id.padEnd(6) + ' | ' +
      r.name.padEnd(24) + ' | ' +
      r.building.padEnd(5) + ' | fl ' +
      String(r.floor).padEnd(4) + ' | ' +
      (r.isLab ? 'LAB' : 'ROOM').padEnd(5) + ' | ' +
      (r.neverScheduled ? 'NEVER_SCHEDULED' : r.cards + ' cards')
    );
  }

  const labs = results.filter(r => r.isLab);
  console.log('\n--- DERIVED LABS (' + labs.length + ') ---');
  console.log(labs.map(l => l.name).join(', '));

  const neverSched = results.filter(r => r.neverScheduled);
  console.log('\n--- NEVER SCHEDULED (' + neverSched.length + ') ---');
  console.log(neverSched.map(n => n.name + ' (' + n.building + ')').join(', '));

  const buildings = {};
  for (const r of results) {
    buildings[r.building] = (buildings[r.building] || 0) + 1;
  }
  console.log('\n--- BUILDING COUNTS ---', JSON.stringify(buildings));
}

run();
