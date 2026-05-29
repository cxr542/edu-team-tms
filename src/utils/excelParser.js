import * as XLSX from 'xlsx';
import {
  resolveUsageCategory,
  normalizeAttendees,
} from '../constants/usageCategories';

/**
 * 팀 빌딩비 지출 장부 컬럼 매핑 규칙 (한국어 변이 고려)
 */
const LEDGER_COLUMN_MAPPINGS = {
  date: ['날짜', '일자', '일시', '년월일', 'Date', '지출일자'],
  category: ['사용 유형', '구분', '분류', '유형', '카테고리', 'Category'],
  description: ['내용', '사용 내역', '내역', '사용처', '상세', '적요', 'Description'],
  amount: ['금액', '지출 금액', '지출액', '사용 금액', '사용액', 'Amount', 'Price', '지출'],
  balance: ['잔액', '잔고', '남은 금액', '남은돈', 'Balance'],
  paymentMethod: ['결제 수단', '결제 구분', '결제', '카드', '결제방법', 'Payment'],
  attendees: ['참석자', '참석자 명단', '참석인원', '명단', '참석', 'Attendees']
};

const TEAM_BUILDING_MEALS = [
  { col: 1, label: '아침' },
  { col: 2, label: '점심' },
  { col: 3, label: '저녁' },
  { col: 4, label: '간식' },
];

function parseAmountCell(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function excelSerialToIso(v) {
  if (typeof v === 'number' && v > 30000) {
    const dateObj = XLSX.SSF.parse_date_code(v);
    const m = String(dateObj.m).padStart(2, '0');
    const d = String(dateObj.d).padStart(2, '0');
    return `${dateObj.y}-${m}-${d}`;
  }
  return null;
}

function recalculateMonthlyBalances(transactions) {
  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  const groups = {};
  sorted.forEach((t) => {
    const ym = t.date.slice(0, 7);
    if (!groups[ym]) groups[ym] = [];
    groups[ym].push(t);
  });
  Object.keys(groups).forEach((ym) => {
    let runningBalance = 150000;
    groups[ym].forEach((tx) => {
      runningBalance -= tx.amount;
      tx.balance = runningBalance;
    });
  });
  return sorted;
}

/**
 * 교육팀 팀 빌딩비 월별 시트 형식 (날짜/아침/점심/저녁/간식/소계) 파싱
 */
export function parseTeamBuildingWorkbook(workbook) {
  const transactions = [];
  let id = 0;

  workbook.SheetNames.forEach((sheetName) => {
    if (!/^\d{2}년\s*\d{1,2}월$/.test(sheetName)) return;

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });

    for (let i = 3; i < rows.length; i++) {
      const row = rows[i];
      const date = excelSerialToIso(row[0]);
      if (!date) continue;

      const note = String(row[7] || '').trim();
      const attendees = normalizeAttendees(String(row[8] || '').trim());
      let hasMeal = false;

      TEAM_BUILDING_MEALS.forEach((meal) => {
        const amount = parseAmountCell(row[meal.col]);
        if (amount <= 0) return;
        hasMeal = true;

        const descParts = [meal.label];
        if (note) descParts.push(note);

        transactions.push({
          id: `tx-${id++}-${Date.now()}`,
          date,
          category: resolveUsageCategory({ note, mealLabel: meal.label }),
          description: descParts.join(' · '),
          amount,
          balance: 0,
          paymentMethod: '법인카드',
          attendees,
          extraData: note ? { 비고: note } : {},
        });
      });

      const subtotal = parseAmountCell(row[5]);
      if (!hasMeal && subtotal > 0) {
        transactions.push({
          id: `tx-${id++}-${Date.now()}`,
          date,
          category: resolveUsageCategory({ note }),
          description: note || `일일 지출 (${sheetName})`,
          amount: subtotal,
          balance: 0,
          paymentMethod: '법인카드',
          attendees,
          extraData: note ? { 비고: note } : {},
        });
      }
    }
  });

  return recalculateMonthlyBalances(transactions);
}

function isTeamBuildingWorkbook(workbook) {
  return workbook.SheetNames.some((name) => /^\d{2}년\s*\d{1,2}월$/.test(name));
}

/**
 * 업로드된 엑셀 파일을 읽고 표준 지출 거래 데이터로 파싱합니다.
 */
export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        if (isTeamBuildingWorkbook(workbook)) {
          const teamBuildingRows = parseTeamBuildingWorkbook(workbook);
          if (!teamBuildingRows.length) {
            throw new Error('팀 빌딩비 시트에서 지출 내역을 찾지 못했습니다.');
          }
          resolve(teamBuildingRows);
          return;
        }

        // 첫 번째 시트 선택 (일반 장부 형식)
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // JSON 객체 배열로 변환
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        
        if (!jsonData || jsonData.length === 0) {
          throw new Error('엑셀 파일에 데이터가 존재하지 않습니다.');
        }

        // 데이터 표준화 가공
        const parsedTransactions = jsonData.map((row, index) => {
          const tx = {
            id: `tx-${index}-${Date.now()}`,
            date: '',
            category: '기타',
            description: '',
            amount: 0,
            balance: 0,
            paymentMethod: '법인카드',
            attendees: normalizeAttendees(''),
            extraData: {}
          };

          Object.keys(row).forEach((key) => {
            const cleanKey = key.trim();
            let matched = false;

            for (const [prop, variations] of Object.entries(LEDGER_COLUMN_MAPPINGS)) {
              if (variations.some(v => cleanKey.toLowerCase() === v.toLowerCase() || cleanKey.includes(v))) {
                if (prop === 'amount' || prop === 'balance') {
                  tx[prop] = Number(String(row[key]).replace(/[^0-9.-]/g, '')) || 0;
                } else if (prop === 'date') {
                  // 엑셀 날짜 형식 변환 처리 (숫자로 넘어올 경우 보정)
                  let val = row[key];
                  if (typeof val === 'number' && val > 30000) {
                    const dateObj = XLSX.SSF.parse_date_code(val);
                    const m = String(dateObj.m).padStart(2, '0');
                    const d = String(dateObj.d).padStart(2, '0');
                    tx[prop] = `${dateObj.y}-${m}-${d}`;
                  } else {
                    tx[prop] = String(val).trim();
                  }
                } else {
                  tx[prop] = String(row[key]).trim();
                }
                matched = true;
                break;
              }
            }

            // 매핑되지 않은 커스텀 컬럼은 extraData에 저장
            if (!matched) {
              tx.extraData[cleanKey] = row[key];
            }
          });

          // 기본값 보정
          if (!tx.date) {
            tx.date = new Date().toISOString().split('T')[0];
          }
          if (!tx.description) {
            tx.description = `지출 내역_${index + 1}`;
          }

          return tx;
        });

        resolve(recalculateMonthlyBalances(parsedTransactions));
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('파일 읽기 오류가 발생했습니다.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 현재 화면의 지출 장부 데이터를 예쁘게 정리된 엑셀 파일로 내보냅니다.
 */
export function exportToExcel(transactions, filename = '교육팀_팀빌딩비_지출장부.xlsx') {
  // 날짜 정렬
  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  const exportData = sorted.map((t) => {
    const row = {
      '날짜': t.date,
      '사용 유형': t.category,
      '사용 내역(상세)': t.description,
      '지출 금액': t.amount,
      '현재 잔액': t.balance,
      '결제 수단': t.paymentMethod,
      '참석자 명단': t.attendees
    };

    // 추가 커스텀 컬럼 병합
    if (t.extraData) {
      Object.entries(t.extraData).forEach(([key, val]) => {
        row[key] = val;
      });
    }

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  
  // 열 넓이 자동 조정
  const maxProps = [{wch: 12}, {wch: 12}, {wch: 25}, {wch: 12}, {wch: 12}, {wch: 12}, {wch: 20}];
  worksheet['!cols'] = maxProps;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '지출 장부');

  XLSX.writeFile(workbook, filename);
}
