import { useCallback, useEffect, useState } from 'react';
import { listCsrAttachmentsFromSupabase } from '../utils/csrAttachmentsSupabase.js';

export function useCsrRequestAttachments(requestId) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!requestId) {
      setAttachments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await listCsrAttachmentsFromSupabase(requestId);
    if (!result.ok) {
      setAttachments([]);
      if (result.status !== 'disabled') setError(result.message);
      setLoading(false);
      return;
    }
    setAttachments(result.data || []);
    setLoading(false);
  }, [requestId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { attachments, loading, error, refresh };
}
