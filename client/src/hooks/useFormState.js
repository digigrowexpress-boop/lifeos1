import { useCallback, useState } from 'react';

/** Small form-state helper: const [v, set, setAll] = useFormState(initial); set('name')(value) */
export function useFormState(initial) {
  const [values, setValues] = useState(initial);
  const set = useCallback((key) => (value) => setValues((v) => ({ ...v, [key]: value })), []);
  return [values, set, setValues];
}
