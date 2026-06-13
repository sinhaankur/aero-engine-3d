/**
 * Engine catalogue. Engines are defined once here and referenced by aircraft so
 * the same powerplant (e.g. the CFM56-5B across the whole A320ceo family) isn't
 * duplicated. Figures are nominal public specifications.
 */

export const ENGINES = {
  'cfm56-5b': {
    id: 'cfm56-5b',
    name: 'CFM56-5B',
    manufacturer: 'CFM International',
    type: 'turbofan',
    thrustKn: 142,
    bypassRatio: 5.5,
    fanDiameterM: 1.73,
    model: '',
    notes: 'Workhorse of the A320ceo family. ~22,000–33,000 lbf thrust range across variants.',
  },
  'v2500': {
    id: 'v2500',
    name: 'IAE V2500',
    manufacturer: 'International Aero Engines',
    type: 'turbofan',
    thrustKn: 147,
    bypassRatio: 4.9,
    fanDiameterM: 1.6,
    model: '',
    notes: 'Alternative powerplant for the A320ceo, known for fuel efficiency on longer sectors.',
  },
  'leap-1a': {
    id: 'leap-1a',
    name: 'CFM LEAP-1A',
    manufacturer: 'CFM International',
    type: 'turbofan',
    thrustKn: 143,
    bypassRatio: 11,
    fanDiameterM: 1.98,
    model: '',
    notes: 'New-engine-option (neo) powerplant. ~15% lower fuel burn vs CFM56 via high bypass ratio.',
  },
  'pw1100g': {
    id: 'pw1100g',
    name: 'Pratt & Whitney PW1100G GTF',
    manufacturer: 'Pratt & Whitney',
    type: 'turbofan',
    thrustKn: 147,
    bypassRatio: 12.5,
    fanDiameterM: 2.06,
    model: '',
    notes: 'Geared turbofan: a reduction gearbox lets the fan and core spin at optimal independent speeds.',
  },
  'pw1500g': {
    id: 'pw1500g',
    name: 'Pratt & Whitney PW1500G GTF',
    manufacturer: 'Pratt & Whitney',
    type: 'turbofan',
    thrustKn: 104,
    bypassRatio: 12,
    fanDiameterM: 1.85,
    model: '',
    notes: 'Geared turbofan for the A220 (formerly Bombardier CSeries).',
  },
}
