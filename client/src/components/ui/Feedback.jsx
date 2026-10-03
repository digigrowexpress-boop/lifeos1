import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, OctagonAlert, Info } from 'lucide-react';
import { Modal } from './Modal.jsx';
import { TextField } from './Fields.jsx';

const ToastContext = createContext(null);
const ConfirmContext = createContext(null);

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const [typed, setTyped] = useState('');
  const resolver = useRef(null);

  const toast = useCallback((message, tone = 'good') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-3), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'critical' ? 6000 : 3200);
  }, []);

  /**
   * confirm({ title, message, confirmLabel, danger, requireText }) → Promise<boolean>
   * requireText: user must type this word to enable the action (for destructive operations).
   */
  const confirm = useCallback((opts) => {
    setTyped('');
    setConfirmState(opts);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setConfirmState(null);
  };

  const toastApi = useMemo(() => ({ toast }), [toast]);
  const confirmApi = useMemo(() => ({ confirm }), [confirm]);
  const blocked = confirmState?.requireText && typed.trim().toLowerCase() !== confirmState.requireText.toLowerCase();

  return (
    <ToastContext.Provider value={toastApi}>
      <ConfirmContext.Provider value={confirmApi}>
        {children}
        <Modal
          open={Boolean(confirmState)}
          onClose={() => close(false)}
          title={confirmState?.title || 'Are you sure?'}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => close(false)}>
                Cancel
              </button>
              <button type="button" className={`btn ${confirmState?.danger ? 'btn-danger' : 'btn-primary'}`} disabled={blocked} onClick={() => close(true)}>
                {confirmState?.confirmLabel || 'Confirm'}
              </button>
            </>
          }
        >
          <div className="stack-sm">
            {confirmState?.message && <p className="text-2">{confirmState.message}</p>}
            {confirmState?.requireText && (
              <TextField
                label={`Type “${confirmState.requireText}” to confirm`}
                value={typed}
                onChange={setTyped}
                autoComplete="off"
              />
            )}
          </div>
        </Modal>
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((t) => {
            const Icon = t.tone === 'critical' ? OctagonAlert : t.tone === 'info' ? Info : CheckCircle2;
            return (
              <div key={t.id} className={`toast tone-${t.tone}`}>
                <Icon size={16} aria-hidden />
                <div>{t.message}</div>
              </div>
            );
          })}
        </div>
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext).toast;
export const useConfirm = () => useContext(ConfirmContext).confirm;
