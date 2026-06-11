export function isLedgerQuotaFailure(result) {
  return (
    result?.reason === 'quota-exceeded' ||
    result?.reason === 'cloud-limited' ||
    /quota|exceeded|용량/i.test(result?.message || '')
  );
}

export function shouldBlockLiveLedgerPublish(result) {
  return (
    isLedgerQuotaFailure(result) ||
    result?.reason === 'not-configured' ||
    result?.reason === 'cloud-limited'
  );
}

/** Policy A: publish failure never triggers backup download from the publish button. */
export function describeLedgerPublishFailure(result) {
  const isQuota = isLedgerQuotaFailure(result);
  if (isQuota) {
    return {
      isQuota: true,
      blockLivePublish: true,
      userMessage:
        'Blob 한도 제한으로 조회 반영에 실패했습니다. 로컬 저장은 유지됩니다. 필요하면 「장부 JSON 백업 다운로드」를 사용하세요.',
    };
  }
  if (result?.reason === 'not-configured') {
    return {
      isQuota: false,
      blockLivePublish: true,
      userMessage:
        result?.message ||
        '조회 반영 서버가 아직 연결되지 않았습니다. 로컬 저장은 유지됩니다.',
    };
  }
  const detail = result?.message || '조회 반영에 실패했습니다.';
  const userMessage = /로컬 저장은 유지/.test(detail)
    ? detail
    : `${detail} 로컬 저장은 유지됩니다.`;
  return {
    isQuota: false,
    blockLivePublish: shouldBlockLiveLedgerPublish(result),
    userMessage,
  };
}
