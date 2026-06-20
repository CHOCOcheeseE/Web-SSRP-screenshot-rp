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

    if (text.startsWith('*')) {
      // Action line → purple
      color = 'purple';
    } else if (text.includes(' says:')) {
      // Conversation
      color = 'white';
    } else if (text.startsWith('**') || text.match(/^\* \* /)) {
      // Automated actions
      if (!includeAutomated) { skip = true; }
      color = 'purple';
    } else if (
      text.startsWith('[radio]') || 
      text.toLowerCase().startsWith('[radio]') ||
      text.match(/^\[.+\] .+ says \(radio\)/i)
    ) {
      if (!includeRadio) { skip = true; }
      color = 'yellow';
    } else {
      // Ignore anything else (Contact info, ads, system messages)
      skip = true;
    }

    // /low detection: if character name is present and it's their /low
    if (characterName && text.includes(`${characterName} says`) && text.includes('(low)')) {
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
    case 'yellow': return '#FFFF00';
    case 'white-bright': return '#FFFFFF';
    case 'white':
    default:
      return '#FFFFFF';
  }
}
