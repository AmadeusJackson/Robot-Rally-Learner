"use strict";

// Shuffle within each source, then take turns across sources so a large deck
// cannot crowd smaller decks out of a short learning run.
function mixSources(items, sourceId, random = Math.random) {
  const shuffle = (values) => {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  const groups = new Map();
  for (const item of items) {
    const key = sourceId(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const queues = shuffle([...groups.values()]).map(shuffle);
  const mixed = [];
  for (let round = 0; queues.some(q => q.length > round); round++) {
    for (const queue of queues) if (queue.length > round) mixed.push(queue[round]);
  }
  return mixed;
}
module.exports = { mixSources };
