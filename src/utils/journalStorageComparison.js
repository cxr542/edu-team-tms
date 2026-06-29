import { TEAM_KPI_MEMBERS } from '../constants/kpiMembers';

function normalizeDateLabel(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function countTasks(slice) {
  return (slice?.days && typeof slice.days === 'object'
    ? Object.values(slice.days).reduce((total, day) => total + (Array.isArray(day?.tasks) ? day.tasks.length : 0), 0)
    : 0);
}

function countDays(slice) {
  return slice?.days && typeof slice.days === 'object' ? Object.keys(slice.days).length : 0;
}

function memberSummary(slice) {
  if (!slice) {
    return {
      exists: false,
      updatedAt: null,
      days: 0,
      tasks: 0,
    };
  }

  return {
    exists: true,
    updatedAt: normalizeDateLabel(slice?.updatedAt || slice?.savedAt || slice?.publishedAt || null),
    days: countDays(slice),
    tasks: countTasks(slice),
  };
}

export function summarizeJournalSnapshot(snapshot) {
  const normalized = snapshot && typeof snapshot === 'object' ? snapshot : null;
  const memberJournals = normalized?.memberJournals && typeof normalized.memberJournals === 'object'
    ? normalized.memberJournals
    : {};
  const members = TEAM_KPI_MEMBERS.map(({ code, displayName, role }) => {
    const slice = memberJournals[code] || null;
    const summary = memberSummary(slice);
    return {
      code,
      displayName,
      role,
      ...summary,
    };
  });

  return {
    exists: Boolean(normalized && Object.keys(memberJournals).length > 0),
    publishedAt: normalizeDateLabel(normalized?.publishedAt || null),
    updatedAt: normalizeDateLabel(normalized?.meta?.updatedAt || normalized?.publishedAt || null),
    members,
  };
}

export function compareJournalSnapshots(blobSnapshot, supabaseSnapshot) {
  const blob = summarizeJournalSnapshot(blobSnapshot);
  const supabase = summarizeJournalSnapshot(supabaseSnapshot);

  const rows = blob.members.map((member, index) => {
    const remote = supabase.members[index] || member;
    const blobExists = member.exists;
    const supabaseExists = remote.exists;
    const bothExist = blobExists && supabaseExists;
    const updatedAtMatches = member.updatedAt === remote.updatedAt;
    const taskCountMatches = member.tasks === remote.tasks;

    let status = 'same';
    if (blobExists && !supabaseExists) status = 'blob-only';
    else if (!blobExists && supabaseExists) status = 'supabase-only';
    else if (!bothExist) status = 'missing';
    else if (!updatedAtMatches || !taskCountMatches) status = 'different';

    return {
      code: member.code,
      displayName: member.displayName,
      role: member.role,
      blob: member,
      supabase: remote,
      status,
      updatedAtMatches,
      taskCountMatches,
    };
  });

  const blobOnlyMembers = rows.filter((row) => row.status === 'blob-only').map((row) => row.code);
  const supabaseOnlyMembers = rows.filter((row) => row.status === 'supabase-only').map((row) => row.code);
  const updatedAtDiffMembers = rows
    .filter((row) => row.status === 'different' && !row.updatedAtMatches)
    .map((row) => row.code);
  const taskCountDiffMembers = rows
    .filter((row) => row.status === 'different' && !row.taskCountMatches)
    .map((row) => row.code);
  const sameMembers = rows.filter((row) => row.status === 'same').map((row) => row.code);

  return {
    blob,
    supabase,
    rows,
    diff: {
      blobOnlyMembers,
      supabaseOnlyMembers,
      updatedAtDiffMembers,
      taskCountDiffMembers,
      sameMembers,
      blobEmpty: !blob.exists,
      supabaseEmpty: !supabase.exists,
    },
  };
}

