/** 문서 제목으로 안전한 .html 파일 이름을 만든다 (경로·특수문자 제거, 한글은 유지). */
export function guideFileName(title, fallback = 'guide') {
  const base = String(title || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 80)
    .trim();
  return `${base || fallback}.html`;
}

/** HTML 문자열을 파일로 내려받는다. */
export function downloadHtmlFile(fileName, html) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
