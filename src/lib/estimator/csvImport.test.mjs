// @ts-nocheck
import assert from 'node:assert/strict';
import test from 'node:test';
import Papa from 'papaparse';
import { mapCsvMatrix, mergeImportedRows, parseCsvText, parseSpreadsheetArray } from './csvImport.js';
import * as XLSX from 'xlsx';

const clients = [
  { key: 'clientCode', label: 'Client Code', type: 'text', visible: true },
  { key: 'fullName', label: 'Full Name', type: 'text', visible: true },
  { key: 'address', label: 'Address', type: 'text', visible: true },
];

const manpower = [
  { key: 'role', label: 'Role / Position', type: 'text', visible: true },
  { key: 'dailyRate', label: 'Daily Rate', type: 'number', visible: true },
  { key: 'monthlyRate', label: 'Monthly Rate', type: 'number', visible: true },
  { key: 'perDiem', label: 'Per Diem', type: 'number', visible: true },
  { key: 'allowance', label: 'Allowance', type: 'number', visible: true },
];

const equipment = [
  { key: 'description', label: 'Description', type: 'text', visible: true },
  { key: 'unit', label: 'Unit', type: 'text', visible: true },
  { key: 'ratePerDay', label: 'Daily Rate', type: 'number', visible: true },
  { key: 'powerKw', label: 'kW', type: 'number', visible: true },
  { key: 'hoursPerDay', label: 'Hrs/Day', type: 'number', visible: true },
  { key: 'kwhRate', label: '₱/kWh', type: 'number', visible: true },
];

function parse(text) {
  return Papa.parse(text, {
    header: false,
    skipEmptyLines: 'greedy',
    delimiter: '',
  }).data;
}

test('clients keep full name when the header matches the sheet', () => {
  const text = [
    'NO.,CLIENT CODE,FULL NAME,ADDRESS',
    '1,SCSE,"San Carlos Sugar Estates","San Carlos Ecozone, San Carlos City, Negros Occidental"',
    '2,PGPC-TIW,"Philippine Geothermal Tiwi","Tiwi, Albay"',
  ].join('\n');
  const { rows, unmatchedLabels } = mapCsvMatrix(parse(text), 'clients', clients);
  assert.equal(unmatchedLabels.length, 0);
  assert.equal(rows[0].clientCode, 'SCSE');
  assert.equal(rows[0].fullName, 'San Carlos Sugar Estates');
  assert.equal(
    rows[0].address,
    'San Carlos Ecozone, San Carlos City, Negros Occidental'
  );
  assert.equal(rows[1].fullName, 'Philippine Geothermal Tiwi');
});

test('a short Name column does not steal Full Name', () => {
  const text = [
    'NO.,NAME,CLIENT CODE,FULL NAME,ADDRESS',
    '1,,SCSE,San Carlos Sugar Estates,"San Carlos Ecozone, San Carlos City"',
  ].join('\n');
  const { rows } = mapCsvMatrix(parse(text), 'clients', clients);
  assert.equal(rows[0].fullName, 'San Carlos Sugar Estates');
  assert.equal(rows[0].clientCode, 'SCSE');
});

test('company name still fills Full Name', () => {
  const text = [
    'CLIENT CODE,COMPANY NAME,ADDRESS',
    'SCSE,San Carlos Sugar Estates,San Carlos Ecozone',
  ].join('\n');
  const { rows } = mapCsvMatrix(parse(text), 'clients', clients);
  assert.equal(rows[0].fullName, 'San Carlos Sugar Estates');
});

test('semicolon files and every manpower column are read', () => {
  const text = [
    'No.;Role / Position;Daily Rate;Monthly Rate;Per Diem;Allowance',
    '1;Welder;850;22000;150;100',
  ].join('\n');
  const { rows, unmatchedLabels } = mapCsvMatrix(parse(text), 'manpower', manpower);
  assert.deepEqual(unmatchedLabels, []);
  assert.equal(rows[0].role, 'Welder');
  assert.equal(rows[0].dailyRate, 850);
  assert.equal(rows[0].monthlyRate, 22000);
  assert.equal(rows[0].perDiem, 150);
  assert.equal(rows[0].allowance, 100);
});

test('tools sheet reads kW, hours, and kWh together', () => {
  const text = [
    'Description,Unit,Daily Rate,kW,Hrs/Day,₱/kWh',
    'Welding machine,day,2500,5,8,12',
  ].join('\n');
  const { rows } = mapCsvMatrix(parse(text), 'equipment', equipment);
  assert.equal(rows[0].description, 'Welding machine');
  assert.equal(rows[0].ratePerDay, 2500);
  assert.equal(rows[0].powerKw, 5);
  assert.equal(rows[0].hoursPerDay, 8);
  assert.equal(rows[0].kwhRate, 12);
});

test('an empty Full Name header does not hide the column that actually has names', () => {
  const text = [
    'NO.,CLIENT CODE,FULL NAME,COMPANY NAME,ADDRESS',
    '1,SCSE,,San Carlos Sugar Estates,"San Carlos Ecozone, San Carlos City, Negros Occidental"',
    '2,PGPC-TIW,,Philippine Geothermal Production Company,"Tiwi, Albay"',
    '3,AAC,,Asian Alcohol Corporation,"Brgy. Canjusa, Pulupandan, Negros Occidental"',
  ].join('\n');
  const { rows, blankLabels } = mapCsvMatrix(parse(text), 'clients', clients);
  assert.equal(rows[0].clientCode, 'SCSE');
  assert.equal(rows[0].fullName, 'San Carlos Sugar Estates');
  assert.equal(rows[1].fullName, 'Philippine Geothermal Production Company');
  assert.equal(rows[2].fullName, 'Asian Alcohol Corporation');
  assert.equal(
    rows[0].address,
    'San Carlos Ecozone, San Carlos City, Negros Occidental'
  );
  assert.equal(blankLabels.includes('Full Name'), false);
});

test('a filled Full Name column still wins over another name column', () => {
  const text = [
    'CLIENT CODE,FULL NAME,COMPANY NAME,ADDRESS',
    'SCSE,San Carlos Sugar Estates,Other Name,San Carlos Ecozone',
  ].join('\n');
  const { rows } = mapCsvMatrix(parse(text), 'clients', clients);
  assert.equal(rows[0].fullName, 'San Carlos Sugar Estates');
});

test('an unrecognized name header is still used when Full Name is missing', () => {
  const text = [
    'CLIENT CODE,LEGAL NAME,ADDRESS',
    'THPAL,Taganito HPAL Nickel Corporation,"Taganito, Claver"',
  ].join('\n');
  const { rows } = mapCsvMatrix(parse(text), 'clients', clients);
  assert.equal(rows[0].fullName, 'Taganito HPAL Nickel Corporation');
  assert.equal(rows[0].address, 'Taganito, Claver');
});

test('a truly empty Full Name is not replaced with the address', () => {
  const text = [
    'NO.,CLIENT CODE,FULL NAME,ADDRESS',
    '1,SCSE,,"San Carlos Ecozone, San Carlos City, Negros Occidental"',
    '2,PGPC-TIW,,"Tiwi, Albay"',
  ].join('\n');
  const { rows, blankLabels } = parseCsvText(text, 'clients', clients);
  assert.equal(rows[0].fullName, '');
  assert.equal(rows[0].clientCode, 'SCSE');
  assert.equal(
    rows[0].address,
    'San Carlos Ecozone, San Carlos City, Negros Occidental'
  );
  assert.equal(rows[1].address, 'Tiwi, Albay');
  assert.ok(blankLabels.includes('Full Name'));
});

test('manpower still reads every column when an alias column is the one with values', () => {
  const text = [
    'No.,Role / Position,Position,Daily Rate,Monthly Rate,Per Diem,Allowance',
    '1,,Welder,850,22000,150,100',
  ].join('\n');
  const { rows } = mapCsvMatrix(parse(text), 'manpower', manpower);
  assert.equal(rows[0].role, 'Welder');
  assert.equal(rows[0].dailyRate, 850);
  assert.equal(rows[0].allowance, 100);
});

test('reimport fills a blank full name on the same client code', () => {
  const existing = [
    { id: 'c1', clientCode: 'SCSE', fullName: '', address: 'Old address' },
    { id: 'c2', clientCode: 'AAC', fullName: '', address: '' },
  ];
  const incoming = [
    {
      id: 'new',
      clientCode: 'SCSE',
      fullName: 'San Carlos Sugar Estates',
      address: 'San Carlos Ecozone, San Carlos City',
    },
    { id: 'new2', clientCode: 'PGPC-TIW', fullName: 'Philippine Geothermal', address: 'Tiwi, Albay' },
  ];
  const { rows, added, updated } = mergeImportedRows(
    existing,
    incoming,
    (row) => row.clientCode
  );
  assert.equal(updated, 1);
  assert.equal(added, 1);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].id, 'c1');
  assert.equal(rows[0].fullName, 'San Carlos Sugar Estates');
  assert.equal(rows[0].address, 'San Carlos Ecozone, San Carlos City');
  assert.equal(rows[2].clientCode, 'PGPC-TIW');
});

test('xlsx clients keep full name', () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['NO.', 'CLIENT CODE', 'FULL NAME', 'ADDRESS'],
    ['1', 'SCSE', 'San Carlos Sugar Estates', 'San Carlos Ecozone, San Carlos City'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Clients');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const { rows } = parseSpreadsheetArray(buf, 'clients', clients);
  assert.equal(rows[0].fullName, 'San Carlos Sugar Estates');
  assert.equal(rows[0].clientCode, 'SCSE');
});
