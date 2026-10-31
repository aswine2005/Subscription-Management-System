import toast, { Toaster as HotToaster } from 'react-hot-toast';

export const showToast = {
  success: (message: string) => {
    toast.success(message, {
      duration: 3500,
      className:
        '!bg-white/90 !text-slate-900 !backdrop-blur-xl !border !border-emerald-500/30 !shadow-xl !shadow-emerald-500/10 !rounded-lg !text-sm !font-medium',
      iconTheme: {
        primary: '#10b981',
        secondary: '#ffffff',
      },
    });
  },
  error: (message: string) => {
    toast.error(message, {
      duration: 4500,
      className:
        '!bg-white/90 !text-slate-900 !backdrop-blur-xl !border !border-rose-500/30 !shadow-xl !shadow-rose-500/10 !rounded-lg !text-sm !font-medium',
      iconTheme: {
        primary: '#ef4444',
        secondary: '#ffffff',
      },
    });
  },
  info: (message: string) => {
    toast(message, {
      duration: 3500,
      className:
        '!bg-white/90 !text-slate-900 !backdrop-blur-xl !border !border-indigo-500/30 !shadow-xl ! !rounded-lg !text-sm !font-medium',
      icon: '💡',
    });
  },
};

export const Toaster = () => {
  return (
    <HotToaster
      position="top-right"
      toastOptions={{
        duration: 3500,
      }}
    />
  );
};
