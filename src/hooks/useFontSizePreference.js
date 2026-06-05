import { useCallback, useState } from 'react';
import {
  FONT_SIZE_OPTIONS,
  applyFontSizePreference,
  getStoredFontSizeId,
} from '../constants/fontSizePreference';

export function useFontSizePreference() {
  const [fontSizeId, setFontSizeIdState] = useState(getStoredFontSizeId);

  const setFontSizeId = useCallback((id) => {
    const opt = applyFontSizePreference(id);
    setFontSizeIdState(opt.id);
    return opt;
  }, []);

  return { fontSizeId, setFontSizeId, options: FONT_SIZE_OPTIONS };
}
