const NOTE_NAMES = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"];
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_INDEX = Object.fromEntries(LETTERS.map((letter, index) => [letter, index]));
const PITCH_CLASS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const WHITE_PITCH_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]);
const CLEF_BOTTOM_NOTE = { treble: { letter: "E", octave: 4 }, bass: { letter: "G", octave: 2 } };
const STAFF_TOP_MIDI = { treble: 77, bass: 57 };

export const KEYBOARD_MIN = 36;
export const KEYBOARD_MAX = 84;

export function midiToNote(midi) {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) {
    throw new RangeError(`Cao độ MIDI không hợp lệ: ${midi}`);
  }
  const pitchClass = midi % 12;
  const names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  return { midi, name: names[pitchClass], octave: Math.floor(midi / 12) - 1 };
}

export function getNaturalMidi(letter, octave) {
  const pitchClass = PITCH_CLASS[letter];
  if (pitchClass === undefined || !Number.isInteger(octave)) {
    throw new TypeError("Tên nốt hoặc quãng tám không hợp lệ.");
  }
  return (octave + 1) * 12 + pitchClass;
}

export function getWrittenPitch(midi) {
  const { name, octave } = midiToNote(midi);
  if (name.includes("♯")) {
    const naturalLetter = LETTERS.find((letter) => PITCH_CLASS[letter] === midi % 12 - 1);
    if (!naturalLetter) throw new RangeError("Không thể xác định cách viết nốt thăng.");
    return { letter: naturalLetter, octave, accidental: "sharp" };
  }
  const letter = LETTERS.find((candidate) => PITCH_CLASS[candidate] === midi % 12);
  if (!letter) throw new RangeError("Không thể xác định tên nốt tự nhiên.");
  return { letter, octave, accidental: null };
}

export function getStaffStep(note, clef) {
  const base = CLEF_BOTTOM_NOTE[clef];
  if (!base) throw new TypeError(`Khóa nhạc không hợp lệ: ${clef}`);
  const noteIndex = note.octave * 7 + LETTER_INDEX[note.letter];
  return noteIndex - (base.octave * 7 + LETTER_INDEX[base.letter]);
}

export function isOutsideStaff(midi, clef) {
  const note = getWrittenPitch(midi);
  const step = getStaffStep(note, clef);
  return step < 0 || midi > STAFF_TOP_MIDI[clef];
}

function choose(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function getAllowedClefs(clefMode) {
  if (clefMode === "treble" || clefMode === "bass") return [clefMode];
  if (clefMode === "both") return ["treble", "bass"];
  throw new TypeError(`Chế độ khóa nhạc không hợp lệ: ${clefMode}`);
}

export function generateQuestion(settings) {
  const { minMidi, maxMidi, clefMode, exercise } = settings;
  if (!Number.isInteger(minMidi) || !Number.isInteger(maxMidi) ||
      minMidi < KEYBOARD_MIN || maxMidi > KEYBOARD_MAX || minMidi > maxMidi) {
    throw new RangeError("Phạm vi nốt nhạc đã chọn không hợp lệ.");
  }
  if (!["natural", "accidentals", "ledger", "mixed"].includes(exercise)) {
    throw new TypeError(`Nội dung luyện tập không hợp lệ: ${exercise}`);
  }

  const clefs = getAllowedClefs(clefMode);
  const candidates = [];
  for (let midi = KEYBOARD_MIN; midi <= KEYBOARD_MAX; midi += 1) {
    if (!WHITE_PITCH_CLASSES.has(midi % 12)) continue;
    for (const clef of clefs) {
      const written = getWrittenPitch(midi);
      const ledger = isOutsideStaff(midi, clef);
      if (exercise === "ledger" && !ledger) continue;
      const detail = { writtenMidi: midi, clef, written, ledger };
      if (exercise !== "accidentals" && midi >= minMidi && midi <= maxMidi) {
        candidates.push({ ...detail, accidental: null, targetMidi: midi, keySignature: null });
      }
      if (exercise === "accidentals" || exercise === "mixed") {
        if (written.letter === "F") {
          if (midi + 1 >= minMidi && midi + 1 <= maxMidi) {
            candidates.push({ ...detail, accidental: "sharp", targetMidi: midi + 1, keySignature: null });
          }
          if (midi >= minMidi && midi <= maxMidi) {
            candidates.push({ ...detail, accidental: "natural", targetMidi: midi, keySignature: { letter: "F", symbol: "♯" } });
          }
        } else if (midi + 1 >= minMidi && midi + 1 <= maxMidi) {
          candidates.push({ ...detail, accidental: "sharp", targetMidi: midi + 1, keySignature: null });
        }
        if (midi - 1 >= minMidi && midi - 1 <= maxMidi) {
          candidates.push({ ...detail, accidental: "flat", targetMidi: midi - 1, keySignature: null });
        }
        if (written.letter === "B" && midi >= minMidi && midi <= maxMidi) {
          candidates.push({ ...detail, accidental: "natural", targetMidi: midi, keySignature: { letter: "B", symbol: "♭" } });
        }
      }
    }
  }

  if (candidates.length === 0) {
    throw new RangeError("Dans phạm vi này không có nốt phù hợp. Hãy mở rộng khoảng nốt hoặc chọn nội dung khác.");
  }
  return choose(candidates);
}

export function formatWrittenName(question) {
  const accidental = { sharp: "♯", flat: "♭", natural: "♮" }[question.accidental] || "";
  return `${NOTE_NAMES[LETTERS.indexOf(question.written.letter)]}${accidental}${question.written.octave}`;
}

export function formatConcertName(midi) {
  const note = midiToNote(midi);
  return `${note.name}${note.octave}`;
}

export function renderStaff(svg, question) {
  if (!(svg instanceof SVGElement)) throw new TypeError("Không tìm thấy khuông nhạc SVG.");
  const { clef, written, accidental, keySignature } = question;
  const step = getStaffStep(written, clef);
  const bottomY = 108;
  const noteY = bottomY - step * 6;
  const noteX = 404;
  const topY = bottomY - 48;
  const verticalShift = 95 - (Math.min(topY, noteY) + Math.max(bottomY, noteY)) / 2;
  const clefSymbol = clef === "treble" ? "𝄞" : "𝄢";
  const clefSize = clef === "treble" ? 77 : 64;
  const signatureOctave = clef === "treble"
    ? keySignature?.letter === "F" ? 5 : 4
    : keySignature?.letter === "F" ? 3 : 2;
  const signatureY = keySignature
    ? bottomY - getStaffStep({ letter: keySignature.letter, octave: signatureOctave }, clef) * 6 + 7
    : 0;
  const keyMark = keySignature
    ? `<text class="key-signature" x="166" y="${signatureY}">${keySignature.symbol}</text>`
    : "";
  const accidentalSymbol = { sharp: "♯", flat: "♭", natural: "♮" }[accidental];
  const accidentalMark = accidentalSymbol
    ? `<text class="staff-accidental" x="${noteX - 40}" y="${noteY + 9}">${accidentalSymbol}</text>`
    : "";
  let ledgerLines = "";
  for (let y = bottomY - 60; y >= noteY; y -= 12) ledgerLines += `<line class="ledger-line" x1="${noteX - 20}" y1="${y}" x2="${noteX + 20}" y2="${y}"/>`;
  for (let y = bottomY + 12; y <= noteY; y += 12) ledgerLines += `<line class="ledger-line" x1="${noteX - 20}" y1="${y}" x2="${noteX + 20}" y2="${y}"/>`;
  const stemDown = noteY <= bottomY - 24;
  const stemX = noteX + (stemDown ? -8 : 8);
  const stemTop = stemDown ? noteY + 2 : noteY - 35;
  const stemBottom = stemDown ? noteY + 35 : noteY - 2;
  const accessibleName = `${clef === "treble" ? "Khóa Sol" : "Khóa Fa"}, một nốt cần nhận diện`;
  svg.setAttribute("aria-label", `Khuông nhạc ${accessibleName}.`);
  svg.innerHTML = `
    <g transform="translate(0 ${verticalShift})">
    <g class="staff-lines">
      <line x1="120" y1="${topY}" x2="625" y2="${topY}"/>
      <line x1="120" y1="${topY + 12}" x2="625" y2="${topY + 12}"/>
      <line x1="120" y1="${topY + 24}" x2="625" y2="${topY + 24}"/>
      <line x1="120" y1="${topY + 36}" x2="625" y2="${topY + 36}"/>
      <line x1="120" y1="${bottomY}" x2="625" y2="${bottomY}"/>
    </g>
    ${keyMark}${ledgerLines}
    <text class="clef-symbol-svg" x="124" y="${clef === "treble" ? 112 : 103}" font-size="${clefSize}">${clefSymbol}</text>
    <text class="svg-clef-name" x="129" y="126">${clef === "treble" ? "SOL" : "FA"}</text>
    ${accidentalMark}
    <ellipse class="notehead" cx="${noteX}" cy="${noteY}" rx="10" ry="7" transform="rotate(-19 ${noteX} ${noteY})"/>
    <line class="note-stem" x1="${stemX}" y1="${stemTop}" x2="${stemX}" y2="${stemBottom}"/>
    </g>
  `;
}

export function getKeyboardNotes() {
  return Array.from({ length: KEYBOARD_MAX - KEYBOARD_MIN + 1 }, (_, index) => {
    const midi = KEYBOARD_MIN + index;
    const note = midiToNote(midi);
    return {
      ...note,
      white: WHITE_PITCH_CLASSES.has(midi % 12),
      label: NOTE_NAMES[["C", "D", "E", "F", "G", "A", "B"].findIndex((letter) => PITCH_CLASS[letter] === midi % 12)],
      isOctaveStart: midi % 12 === 0
    };
  });
}
