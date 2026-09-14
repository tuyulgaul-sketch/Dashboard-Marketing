import type ExcelJS from 'exceljs';
import type { User } from '@/types';
import type { MarketingTemplateRow } from './marketingWorkbook';
import { LEGACY_TARGET_HEADERS } from './targetCompact';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'] as const;
const HOLDER_ROLES = new Set([
  'DIRECTOR_MARKETING','ADVISOR_MARKETING_DIRECTOR','VP_CAPTIVE_MARKETING','VP_CORPORATE_RETAIL_MARKETING',
  'DEPARTMENT_HEAD_MARKETING','SUPERVISOR_MARKETING','STAFF_MARKETING',
]);
const MONEY = '#,##0;[Red](#,##0)';
const BLUE = 'FF163C72';
const DARK = 'FF17324D';
const GREEN = 'FFD9EAD3';
const RED = 'FFF4CCCC';
const LIGHT = 'FFEAF2F8';

const idOf = (value: unknown) => String(value ?? '').trim().toUpperCase();
const holdersOf = (users: User[]) => users.filter(user => user.status === 'Active' && HOLDER_ROLES.has(user.role) && /^USR-\d{6}$/.test(idOf(user.id)));
const col = (index: number) => { let n=index, out=''; while(n){ n--; out=String.fromCharCode(65+(n%26))+out; n=Math.floor(n/26); } return out; };
const dataMonthCols = MONTHS.map((_, i) => ({ NB: col(13 + i*2), RN: col(14 + i*2) }));

export const prepareTargetTemplateRows = (users: User[], inputRows: MarketingTemplateRow[]) => {
  const holders = holdersOf(users);
  if (!holders.length) throw new Error('Daftar pemilik target aktif belum tersedia.');
  const directors = holders.filter(user => user.role === 'DIRECTOR_MARKETING');
  if (directors.length !== 1) throw new Error('User Master harus memiliki tepat satu Direktur Marketing aktif.');
  const year = Number(inputRows.find(row => Number(row.Tahun))?.Tahun ?? new Date().getFullYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Tahun target tidak valid.');
  const rows: MarketingTemplateRow[] = holders.map(user => {
    const row: MarketingTemplateRow = {
      Tahun: year,
      'User ID Penerima': idOf(user.id),
      'Nama Penerima': user.name,
      Jabatan: user.position || '',
      'Department Umum': user.unit || '',
      'Department Sub': user.department || '',
      'Target Tahunan': 0,
      'Target Tahunan NB': 0,
      'Target Tahunan RN': 0,
      'Target Pribadi': 0,
      'Target Pribadi NB': 0,
      'Target Pribadi RN': 0,
      Catatan: '',
    };
    MONTHS.forEach(month => { row[`${month} NB`] = 0; row[`${month} RN`] = 0; });
    return row;
  });
  return { year, holders, rows };
};

const headerStyle = (row: ExcelJS.Row) => {
  row.height = 28;
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
};
const titleStyle = (cell: ExcelJS.Cell) => {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
  cell.alignment = { vertical: 'middle' };
};
const greenFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN }, bgColor: { argb: GREEN } } as const;
const redFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED }, bgColor: { argb: RED } } as const;

export const applyTargetValidationWorkbook = (
  workbook: ExcelJS.Workbook,
  dataSheet: ExcelJS.Worksheet,
  users: User[],
  year: number
): void => {
  const holders = holdersOf(users);
  const director = holders.find(user => user.role === 'DIRECTOR_MARKETING');
  if (!director) throw new Error('Direktur Marketing aktif tidak ditemukan.');
  const byId = new Map(holders.map(user => [idOf(user.id), user]));
  const children = new Map<string, string[]>();
  holders.forEach(user => children.set(idOf(user.id), []));
  holders.forEach(user => {
    const parent = idOf(user.superiorId);
    if (parent && children.has(parent)) children.get(parent)!.push(idOf(user.id));
  });
  const directorDataRow = holders.findIndex(user => idOf(user.id) === idOf(director.id)) + 2;
  workbook.calcProperties.fullCalcOnLoad = true;
  workbook.calcProperties.forceFullCalc = true;
  workbook.calcProperties.calcMode = 'auto';

  // Acuan bulanan Direktorat yang diisi user.
  const baseline = workbook.addWorksheet('Target Direktorat', { views: [{ state: 'frozen', ySplit: 1 }] });
  baseline.addRow(['Bulan','Target Direktorat NB','Target Direktorat RN','Total']);
  headerStyle(baseline.getRow(1));
  MONTHS.forEach((month, index) => {
    const r=index+2;
    baseline.addRow([month,0,0]);
    baseline.getCell(`D${r}`).value = { formula: `B${r}+C${r}`, result: 0 };
  });
  baseline.getCell('A15').value='TAHUNAN';
  baseline.getCell('B15').value={ formula:'SUM(B2:B13)', result:0 };
  baseline.getCell('C15').value={ formula:'SUM(C2:C13)', result:0 };
  baseline.getCell('D15').value={ formula:'B15+C15', result:0 };
  baseline.getRow(15).font={ bold:true };
  baseline.getRow(15).fill={ type:'pattern', pattern:'solid', fgColor:{ argb: GREEN } };
  [18,24,24,24].forEach((w,i)=> baseline.getColumn(i+1).width=w);
  baseline.getColumn(2).numFmt=MONEY; baseline.getColumn(3).numFmt=MONEY; baseline.getColumn(4).numFmt=MONEY;

  // Metadata baseline disimpan di Data Target agar validasi aplikasi dapat mengulang pengecekan tanpa mempercayai formula summary.
  const hiddenStart = LEGACY_TARGET_HEADERS.length + 1;
  MONTHS.forEach((month,index) => {
    const nbIndex=hiddenStart+(index*2), rnIndex=nbIndex+1;
    const nbHeader=`Target Direktorat ${month} NB`, rnHeader=`Target Direktorat ${month} RN`;
    dataSheet.getCell(1,nbIndex).value=nbHeader; dataSheet.getCell(1,rnIndex).value=rnHeader;
    dataSheet.getColumn(nbIndex).hidden=true; dataSheet.getColumn(rnIndex).hidden=true;
    dataSheet.getCell(directorDataRow,nbIndex).value={ formula:`'Target Direktorat'!B${index+2}`, result:0 };
    dataSheet.getCell(directorDataRow,rnIndex).value={ formula:`'Target Direktorat'!C${index+2}`, result:0 };
    dataSheet.getCell(directorDataRow,nbIndex).numFmt=MONEY; dataSheet.getCell(directorDataRow,rnIndex).numFmt=MONEY;
  });

  // Tambahkan hierarchy ke directory yang sudah dibuat generator utama.
  const directory=workbook.getWorksheet('Daftar User ID');
  if (directory) {
    directory.getCell('G1').value='Atasan User ID'; directory.getCell('H1').value='Atasan';
    headerStyle(directory.getRow(1));
    for(let r=2;r<=directory.rowCount;r++){
      const uid=idOf(directory.getCell(r,1).value);
      const user=byId.get(uid);
      if(!user) continue;
      const parent=idOf(user.superiorId);
      directory.getCell(r,7).value=parent;
      directory.getCell(r,8).value=parent ? (byId.get(parent)?.name || '') : '';
    }
    directory.getColumn(7).width=18; directory.getColumn(8).width=30;
    directory.autoFilter={ from:'A1', to:`H${directory.rowCount}` };
  }

  // Ringkasan Validasi: diagnosis per bulan dan per user.
  const summary=workbook.addWorksheet('Ringkasan Validasi', { views:[{ state:'frozen', ySplit:4 }] });
  summary.mergeCells('A1:L2'); summary.getCell('A1').value=`RINGKASAN VALIDASI SETUP TARGET ${year}`; titleStyle(summary.getCell('A1'));
  summary.addRow([]);
  ['Indikator','Nilai','','Bulan','Target Direktorat NB','Total Alokasi NB','Selisih NB','Status NB','Target Direktorat RN','Total Alokasi RN','Selisih RN','Status RN']
    .forEach((v,i)=> summary.getCell(4,i+1).value=v);
  headerStyle(summary.getRow(4));
  summary.getCell('A5').value='Jumlah Pemegang Target'; summary.getCell('B5').value=holders.length;
  summary.getCell('A6').value='User Belum Balance';
  summary.getCell('A7').value='Bulan NB Belum Balance'; summary.getCell('B7').value={ formula:'COUNTIF(H5:H16,"BELUM BALANCE")' };
  summary.getCell('A8').value='Bulan RN Belum Balance'; summary.getCell('B8').value={ formula:'COUNTIF(L5:L16,"BELUM BALANCE")' };
  summary.getCell('A9').value='Tahunan Direktorat NB'; summary.getCell('B9').value={ formula:`IF(SUM('Target Direktorat'!B2:B13)=SUMIF('Data Target'!$B$2:$B$500,"${idOf(director.id)}",'Data Target'!$H$2:$H$500),"BALANCE","BELUM BALANCE")` };
  summary.getCell('A10').value='Tahunan Direktorat RN'; summary.getCell('B10').value={ formula:`IF(SUM('Target Direktorat'!C2:C13)=SUMIF('Data Target'!$B$2:$B$500,"${idOf(director.id)}",'Data Target'!$I$2:$I$500),"BALANCE","BELUM BALANCE")` };
  MONTHS.forEach((month,index)=>{
    const r=index+5, cols=dataMonthCols[index];
    summary.getCell(`D${r}`).value=month;
    summary.getCell(`E${r}`).value={ formula:`'Target Direktorat'!B${index+2}` };
    summary.getCell(`F${r}`).value={ formula:`SUM('Data Target'!$${cols.NB}$2:$${cols.NB}$500)` };
    summary.getCell(`G${r}`).value={ formula:`F${r}-E${r}` };
    summary.getCell(`H${r}`).value={ formula:`IF(G${r}=0,"BALANCE","BELUM BALANCE")` };
    summary.getCell(`I${r}`).value={ formula:`'Target Direktorat'!C${index+2}` };
    summary.getCell(`J${r}`).value={ formula:`SUM('Data Target'!$${cols.RN}$2:$${cols.RN}$500)` };
    summary.getCell(`K${r}`).value={ formula:`J${r}-I${r}` };
    summary.getCell(`L${r}`).value={ formula:`IF(K${r}=0,"BALANCE","BELUM BALANCE")` };
    ['E','F','G','I','J','K'].forEach(c=>summary.getCell(`${c}${r}`).numFmt=MONEY);
  });
  summary.addConditionalFormatting({ ref:'H5:H16', rules:[
    { type:'expression', formulae:['H5="BALANCE"'], priority:1, style:{ fill:greenFill } },
    { type:'expression', formulae:['H5="BELUM BALANCE"'], priority:2, style:{ fill:redFill } },
  ]});
  summary.addConditionalFormatting({ ref:'L5:L16', rules:[
    { type:'expression', formulae:['L5="BALANCE"'], priority:1, style:{ fill:greenFill } },
    { type:'expression', formulae:['L5="BELUM BALANCE"'], priority:2, style:{ fill:redFill } },
  ]});

  const detailStart=20;
  ['User ID','Nama','Atasan ID','Status','Lokasi Error','Selisih Cascading Total','Selisih Cascading NB','Selisih Cascading RN','Selisih 12 Bulan NB','Selisih 12 Bulan RN']
    .forEach((v,i)=>summary.getCell(detailStart,i+1).value=v);
  headerStyle(summary.getRow(detailStart));
  holders.forEach((user,index)=>{
    const r=detailStart+index+1, uid=idOf(user.id), parent=idOf(user.superiorId), childIds=children.get(uid) || [];
    const childSum=(sourceCol:string)=>childIds.length ? childIds.map(id=>`SUMIF('Data Target'!$B$2:$B$500,"${id}",'Data Target'!$${sourceCol}$2:$${sourceCol}$500)`).join('+') : '0';
    const monthly=(kind:'NB'|'RN')=>dataMonthCols.map(c=>`SUMIF('Data Target'!$B$2:$B$500,"${uid}",'Data Target'!$${c[kind]}$2:$${c[kind]}$500)`).join('+');
    const annualTotal=`SUMIF('Data Target'!$B$2:$B$500,"${uid}",'Data Target'!$G$2:$G$500)`;
    const annualNB=`SUMIF('Data Target'!$B$2:$B$500,"${uid}",'Data Target'!$H$2:$H$500)`;
    const annualRN=`SUMIF('Data Target'!$B$2:$B$500,"${uid}",'Data Target'!$I$2:$I$500)`;
    const personalTotal=`SUMIF('Data Target'!$B$2:$B$500,"${uid}",'Data Target'!$J$2:$J$500)`;
    const personalNB=`SUMIF('Data Target'!$B$2:$B$500,"${uid}",'Data Target'!$K$2:$K$500)`;
    const personalRN=`SUMIF('Data Target'!$B$2:$B$500,"${uid}",'Data Target'!$L$2:$L$500)`;
    const diffTotal=`(${annualTotal})-((${personalTotal})+(${childSum('G')}))`;
    const diffNB=`(${annualNB})-((${personalNB})+(${childSum('H')}))`;
    const diffRN=`(${annualRN})-((${personalRN})+(${childSum('I')}))`;
    const diffMonthNB=`(${monthly('NB')})-(${personalNB})`;
    const diffMonthRN=`(${monthly('RN')})-(${personalRN})`;
    summary.getCell(`A${r}`).value=uid; summary.getCell(`B${r}`).value=user.name; summary.getCell(`C${r}`).value=parent;
    summary.getCell(`F${r}`).value={ formula:diffTotal }; summary.getCell(`G${r}`).value={ formula:diffNB }; summary.getCell(`H${r}`).value={ formula:diffRN };
    summary.getCell(`I${r}`).value={ formula:diffMonthNB }; summary.getCell(`J${r}`).value={ formula:diffMonthRN };
    summary.getCell(`D${r}`).value={ formula:`IF(AND(F${r}=0,G${r}=0,H${r}=0,I${r}=0,J${r}=0,COUNTIF('Data Target'!$B$2:$B$500,A${r})=1),"LOLOS","BELUM BALANCE")` };
    summary.getCell(`E${r}`).value={ formula:`IF(COUNTIF('Data Target'!$B$2:$B$500,A${r})<>1,"Baris User hilang/duplikat; ","")&IF(F${r}<>0,"Cascading Total; ","")&IF(G${r}<>0,"Cascading NB; ","")&IF(H${r}<>0,"Cascading RN; ","")&IF(I${r}<>0,"Jumlah 12 Bulan NB; ","")&IF(J${r}<>0,"Jumlah 12 Bulan RN; ","")` };
    ['F','G','H','I','J'].forEach(c=>summary.getCell(`${c}${r}`).numFmt=MONEY);
  });
  const detailEnd=detailStart+holders.length;
  summary.getCell('B6').value={ formula:`COUNTIF(D${detailStart+1}:D${detailEnd},"BELUM BALANCE")` };
  summary.addConditionalFormatting({ ref:`D${detailStart+1}:D${detailEnd}`, rules:[
    { type:'expression', formulae:[`D${detailStart+1}="LOLOS"`], priority:1, style:{ fill:greenFill } },
    { type:'expression', formulae:[`D${detailStart+1}="BELUM BALANCE"`], priority:2, style:{ fill:redFill } },
  ]});
  [18,28,18,18,48,22,22,22,22,22,18,18].forEach((w,i)=>summary.getColumn(i+1).width=w);

  // Matriks bulanan untuk menelusuri kontribusi tiap user.
  const recon=workbook.addWorksheet('Rekonsiliasi Bulanan', { views:[{ state:'frozen', ySplit:4, xSplit:2 }] });
  recon.mergeCells('A1:Z2'); recon.getCell('A1').value='REKONSILIASI TARGET PRIBADI BULANAN PER USER'; titleStyle(recon.getCell('A1'));
  recon.getCell('A4').value='User ID'; recon.getCell('B4').value='Nama';
  MONTHS.forEach((month,index)=>{ recon.getCell(4,3+index*2).value=`${month} NB`; recon.getCell(4,4+index*2).value=`${month} RN`; });
  headerStyle(recon.getRow(4));
  holders.forEach((user,index)=>{
    const r=index+5, uid=idOf(user.id); recon.getCell(`A${r}`).value=uid; recon.getCell(`B${r}`).value=user.name;
    MONTHS.forEach((_,m)=>{
      const nb=recon.getCell(r,3+m*2), rn=recon.getCell(r,4+m*2), src=dataMonthCols[m];
      nb.value={ formula:`SUMIF('Data Target'!$B$2:$B$500,$A${r},'Data Target'!$${src.NB}$2:$${src.NB}$500)` };
      rn.value={ formula:`SUMIF('Data Target'!$B$2:$B$500,$A${r},'Data Target'!$${src.RN}$2:$${src.RN}$500)` };
      nb.numFmt=MONEY; rn.numFmt=MONEY;
    });
  });
  const totalRow=holders.length+6, targetRow=totalRow+1, diffRow=totalRow+2, statusRow=totalRow+3;
  recon.getCell(`A${totalRow}`).value='TOTAL ALOKASI'; recon.getCell(`A${targetRow}`).value='TARGET DIREKTORAT'; recon.getCell(`A${diffRow}`).value='SELISIH'; recon.getCell(`A${statusRow}`).value='STATUS';
  MONTHS.forEach((_,m)=>{
    const nb=col(3+m*2), rn=col(4+m*2), last=holders.length+4;
    recon.getCell(`${nb}${totalRow}`).value={ formula:`SUM(${nb}5:${nb}${last})` }; recon.getCell(`${rn}${totalRow}`).value={ formula:`SUM(${rn}5:${rn}${last})` };
    recon.getCell(`${nb}${targetRow}`).value={ formula:`'Target Direktorat'!B${m+2}` }; recon.getCell(`${rn}${targetRow}`).value={ formula:`'Target Direktorat'!C${m+2}` };
    recon.getCell(`${nb}${diffRow}`).value={ formula:`${nb}${totalRow}-${nb}${targetRow}` }; recon.getCell(`${rn}${diffRow}`).value={ formula:`${rn}${totalRow}-${rn}${targetRow}` };
    recon.getCell(`${nb}${statusRow}`).value={ formula:`IF(${nb}${diffRow}=0,"BALANCE","BELUM BALANCE")` }; recon.getCell(`${rn}${statusRow}`).value={ formula:`IF(${rn}${diffRow}=0,"BALANCE","BELUM BALANCE")` };
    [totalRow,targetRow,diffRow].forEach(r=>{ recon.getCell(`${nb}${r}`).numFmt=MONEY; recon.getCell(`${rn}${r}`).numFmt=MONEY; });
  });
  recon.getColumn('A').width=18; recon.getColumn('B').width=30; for(let c=3;c<=26;c++) recon.getColumn(c).width=15;
  [totalRow,targetRow,diffRow,statusRow].forEach(r=>{ recon.getRow(r).font={ bold:true }; recon.getRow(r).fill={ type:'pattern', pattern:'solid', fgColor:{ argb: LIGHT } }; });

  const guide=workbook.addWorksheet('Petunjuk');
  guide.mergeCells('A1:B2'); guide.getCell('A1').value='PETUNJUK TEMPLATE TARGET + VALIDASI OTOMATIS'; titleStyle(guide.getCell('A1'));
  guide.addRow([]); guide.addRow(['Sheet','Fungsi']); headerStyle(guide.getRow(4));
  [
    ['Data Target','Isi target dengan format 1 baris per pemegang target. Jangan menghapus pemegang target aktif.'],
    ['Target Direktorat','Isi target bulanan Direktorat NB/RN sebagai baseline Januari–Desember.'],
    ['Ringkasan Validasi','Lihat siapa yang belum balance, jenis error, bulan yang tidak balance, dan selisih rupiahnya.'],
    ['Rekonsiliasi Bulanan','Lihat kontribusi tiap user per bulan dan total dibandingkan target Direktorat.'],
    ['Daftar User ID','Referensi User ID dan struktur atasan.'],
    ['Aturan','Target Tahunan = Target Pribadi + Target Bawahan langsung; dicek Total, NB, dan RN.'],
    ['Aturan','Jumlah Januari–Desember NB = Target Pribadi NB; RN juga harus sama.'],
    ['Aturan','Total alokasi pribadi seluruh holder pada setiap bulan harus sama dengan Target Direktorat bulan tersebut.'],
    ['Catatan','Excel adalah pre-validator. Sistem tetap mengulang validasi saat upload dan sebelum Publish.'],
  ].forEach(row=>guide.addRow(row));
  guide.getColumn('A').width=28; guide.getColumn('B').width=100; guide.eachRow(row=>{ row.alignment={ vertical:'top', wrapText:true }; });
};
