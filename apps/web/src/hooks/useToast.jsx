import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

const VARIANTS = {
  success: { bg: 'success', Icon: CheckCircle2 },
  error: { bg: 'danger', Icon: AlertCircle },
  info: { bg: 'primary', Icon: Info }
};

// Provider thông báo nổi (toast) dùng chung toàn app. Đặt trong App.jsx để mọi
// trang (kể cả Login/trang khách ngoài AppShell) đều gọi được useToast().
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const nextId = useRef(1);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(({ variant = 'info', message }) => {
    if (!message) return;
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, variant, message }]);
  }, []);

  const toast = useMemo(() => ({
    show,
    success: (message) => show({ variant: 'success', message }),
    error: (message) => show({ variant: 'error', message }),
    info: (message) => show({ variant: 'info', message })
  }), [show]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 1090 }}>
        {items.map(({ id, variant, message }) => {
          const { bg, Icon } = VARIANTS[variant] || VARIANTS.info;
          return (
            <Toast key={id} bg={bg} onClose={() => remove(id)} delay={3500} autohide>
              <Toast.Body className="d-flex align-items-center gap-2 text-white">
                <Icon size={18} className="flex-shrink-0" />
                <span className="flex-grow-1">{message}</span>
              </Toast.Body>
            </Toast>
          );
        })}
      </ToastContainer>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast phải được dùng bên trong <ToastProvider>');
  return ctx;
}
