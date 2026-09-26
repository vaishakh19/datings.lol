import React, {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './context/AuthContext';

/**
 * Last-resort render guard. Without it, any component crash unmounts the whole
 * React tree and the user is left staring at a blank white page with no clue
 * what happened. This keeps the failure visible, actionable, and non-fatal.
 */
class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('datings.lol render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-[#FFFBEB] flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[440px] bg-white border-[3px] border-black rounded-[22px] p-6 brutal-shadow text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#FFE066] border-[3px] border-black flex items-center justify-center text-xl">
            💥
          </div>
          <h1 className="text-[20px] font-black mt-4 tracking-tight">Well, that broke.</h1>
          <p className="text-[12px] font-bold mt-2 opacity-70">
            Something went wrong while rendering this screen. Your account and data are safe.
          </p>
          {this.state.error.message && (
            <p className="text-[10px] font-mono mt-3 p-2.5 bg-black/[0.04] border border-black/10 rounded-lg break-words text-left">
              {this.state.error.message}
            </p>
          )}
          <div className="flex gap-2.5 justify-center mt-5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="bg-black text-white font-black text-[12px] px-4 py-2.5 rounded-full border-[2.5px] border-black hover:bg-neutral-800 cursor-pointer"
            >
              Reload app
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/dashboard')}
              className="bg-white text-black font-black text-[12px] px-4 py-2.5 rounded-full border-[2.5px] border-black hover:bg-[#FFE066] cursor-pointer"
            >
              Back to Today
            </button>
          </div>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </GlobalErrorBoundary>
  </StrictMode>,
);
