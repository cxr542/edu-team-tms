#!/usr/bin/env node
/**
 * docs/reference-source → public/docs/reference 동기화
 * (선택) TMS_MONOREPO_ROOT 아래 kpi-app-new/docs 가 있으면 해당 파일로 덮어씀
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMS_ROOT = path.resolve(__dirname, '..');
const INTERNAL_SOURCE = path.join(TMS_ROOT, 'docs/reference-source');
const OUT = path.join(TMS_ROOT, 'public/docs/reference');
const MONOREPO_ROOT = process.env.TMS_MONOREPO_ROOT || path.resolve(TMS_ROOT, '../..');

const EXTERNAL_COPIES = [
  {
    from: path.join(MONOREPO_ROOT, 'apps/kpi-app-new/docs/교육팀_KPI_정의서_2026.md'),
    to: '교육팀_KPI_정의서.md',
  },
  {
    from: path.join(MONOREPO_ROOT, 'apps/kpi-app-new/docs/KPI-TMS-운영모델-v2.md'),
    to: 'KPI-TMS-운영모델-v2.md',
  },
  {
    from: path.join(MONOREPO_ROOT, 'apps/kpi-app-new/docs/KPI-TMS-팀KPI메뉴.md'),
    to: 'KPI-TMS-팀KPI메뉴.md',
  },
  {
    from: path.join(MONOREPO_ROOT, 'apps/kpi-app-new/docs/KPI-일지-TMS-연계-가이드.md'),
    to: 'KPI-일지-TMS-연계-가이드.md',
  },
  {
    from: path.join(MONOREPO_ROOT, 'apps/kpi-app-new/docs/KPI-Academizer-TMS-시나리오예시.md'),
    to: 'KPI-Academizer-TMS-시나리오예시.md',
  },
  {
    from: path.join(MONOREPO_ROOT, 'apps/kpi-app-new/docs/pilot-checklist-v2-tms.md'),
    to: 'pilot-checklist-v2-tms.md',
  },
  {
    from: path.join(MONOREPO_ROOT, 'apps/kpi-app-new/docs/KPI-TMS-traceability-tms.md'),
    to: 'KPI-TMS-traceability-tms.md',
  },
  {
    from: path.join(MONOREPO_ROOT, 'apps/kpi-app-new/docs/sources/교육팀_KPI_정의서_v5_KPI1.md'),
    to: 'sources/교육팀_KPI_정의서_v5_KPI1.md',
  },
  {
    from: path.join(MONOREPO_ROOT, 'apps/kpi-app-new/docs/sources/교육팀_KPI_정의서_v5_KPI2.md'),
    to: 'sources/교육팀_KPI_정의서_v5_KPI2.md',
  },
];

function copyFile(from, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(from, dest);
}

function copyInternalSource() {
  if (!fs.existsSync(INTERNAL_SOURCE)) {
    return 0;
  }
  let count = 0;
  const walk = (dir, rel = '') => {
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      const relPath = rel ? `${rel}/${name}` : name;
      if (fs.statSync(abs).isDirectory()) {
        walk(abs, relPath);
        continue;
      }
      if (!name.endsWith('.md')) continue;
      if (name === 'README.md') continue;
      copyFile(abs, path.join(OUT, relPath));
      console.log('copied (internal):', relPath);
      count += 1;
    }
  };
  walk(INTERNAL_SOURCE);
  return count;
}

function copyExternalOverrides() {
  let ok = 0;
  let skip = 0;
  for (const { from, to } of EXTERNAL_COPIES) {
    if (!fs.existsSync(from)) {
      skip += 1;
      continue;
    }
    copyFile(from, path.join(OUT, to));
    console.log('copied (monorepo override):', to);
    ok += 1;
  }
  return { ok, skip };
}

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, 'sources'), { recursive: true });

const internalCount = copyInternalSource();
const { ok: externalOk, skip: externalSkip } = copyExternalOverrides();

if (internalCount === 0 && externalOk === 0) {
  console.warn(
    'No reference docs synced. Edit docs/reference-source/*.md or set TMS_MONOREPO_ROOT.',
  );
} else {
  console.log(
    `done: ${internalCount} internal, ${externalOk} monorepo override(s), ${externalSkip} external skip → ${OUT}`,
  );
}
