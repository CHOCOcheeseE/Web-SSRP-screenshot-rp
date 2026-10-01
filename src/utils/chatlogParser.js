// Parse chatlog text into structured lines
export function parseChatlog(raw, settings = {}) {
  if (!raw || !raw.trim()) return [];

  const {
    includeNotices = true,
    includeRadio = true,
    includeAutomated = false,
    includeBroadcasts = false,
    characterName = '',
  } = settings;

  const lines = raw.split('\n');
  const result = [];

  for (let line of lines) {
    let text = line.trim();

    // Preserve empty lines as spacers (so user can push text down)
    if (!text) {
      result.push({ raw: '', text: '', timestamp: null, color: 'white', isSpacer: true });
      continue;
    }

    // Strip timestamp if present [HH:MM:SS]
    let timestamp = null;
    const tsMatch = text.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*/);
    if (tsMatch) {
      timestamp = tsMatch[1];
      text = text.slice(tsMatch[0].length);
    }

    // Strip hex colors {RRGGBB}
    text = text.replace(/\{[A-Fa-f0-9]{6}\}/g, '');

    if (!text) continue;

    // Determine line type and color
    let color = 'white';
    let skip = false;

    // 1. Automated actions (** or * *)
    if (text.startsWith('**') || text.match(/^\*\s*\*/)) {
      if (!includeAutomated) { skip = true; }
      color = 'purple';
    }
    // 2. Action / Roleplay lines (* /me, /do, /ame, /ado, >)
    else if (text.startsWith('*') || text.startsWith('>')) {
      color = 'purple';
    }
    // 3. Megaphone speech
    else if (
      text.match(/megaphone/i) || 
      text.match(/^\[megaphone\]/i)
    ) {
      color = 'yellow';
    }
    // 4. Radio / Walkie-talkie
    else if (
      text.toLowerCase().startsWith('[radio]') || 
      text.toLowerCase().startsWith('[wt]') ||
      text.match(/\[.+\]\s*.+says\s*\(radio\)/i) ||
      text.match(/\(radio\)/i) ||
      text.match(/\[radio\]/i) ||
      text.match(/\(walkie\)/i) ||
      text.match(/\[walkie\]/i)
    ) {
      if (!includeRadio) { skip = true; }
      color = 'yellow';
    }
    // 5. Speech & Dialogue: says, shouts, whispers, screams, yells, asks (with any (to ...), [low], etc.)
    else if (text.match(/\b(says|shouts|whispers|screams|yells|asks)\b.*?:/i)) {
      color = 'white';
    }
    // 6. Broadcasts (news, ads, government)
    else if (
      text.match(/^\[(AD|NEWS|SAN|GOV|LIVE)\]/i) ||
      text.match(/^(Advertisement|SAN News):/i)
    ) {
      if (!includeBroadcasts) { skip = true; }
      color = 'broadcast';
    }
    // 7. Server / System notices
    else if (
      text.match(/^\[(INFO|NOTICE|NOTE)\]/i) ||
      text.match(/^(INFO|NOTICE):/i)
    ) {
      if (!includeNotices) { skip = true; }
      color = 'yellow';
    }
    // 8. OOC chat (( ... ))
    else if (
      text.startsWith('((') || 
      text.endsWith('))') ||
      text.match(/^[A-Za-z0-9_ ]+:\s*\(\(/) ||
      text.includes('(( [OOC]')
    ) {
      color = 'white';
    }
    // 9. Custom dialogue format: "Name: message" (excluding known system keywords)
    else if (
      text.match(/^[A-Za-z0-9_ ()[\]]+:\s*.+/) &&
      !text.match(/^(SERVER|SYSTEM|BANK|ADMIN|ADMINISTRATOR|ERROR|USAGE|PAYCHECK|WARNING|PAGER):/i)
    ) {
      color = 'white';
    }
    else {
      // Ignore other system logs / connecting messages
      skip = true;
    }

    // /low detection: if character name is present and it's their /low
    if (characterName && text.includes(characterName) && (text.includes('(low)') || text.includes('[low]'))) {
      color = 'white-bright';
    }

    if (!skip) {
      result.push({
        raw: line.trim(),
        text,
        timestamp,
        color,
      });
    }
  }

  return result;
}

// Determine rendered color for canvas
export function getLineColor(colorKey) {
  switch (colorKey) {
    case 'purple': return '#C2A2DA'; // Exact SA-MP /me color
    case 'yellow': return '#FFFF00'; // Radio / Megaphone / Notices
    case 'broadcast': return '#33AA33'; // Ads / News
    case 'white-bright': return '#FFFFFF';
    case 'white':
    default:
      return '#FFFFFF';
  }
}
