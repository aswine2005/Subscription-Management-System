import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Brand } from '../../components/ui/Brand';
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <aside className="auth-story">
        <Brand />
        <div className="py-12">
          <div className="eyebrow mb-7">Subscription business, beautifully in order.</div>
          <h1>
            Make room
            <br />
            for your
            <br />
            <em>next chapter.</em>
          </h1>
          <p className="text-sm text-[#7d886d] leading-7 mt-6 max-w-sm">
            The plans, the people, the payments.
            <br />
            One thoughtful workspace to keep it all moving.
          </p>
          <div className="auth-ledger">
            <div className="flex justify-between items-center mb-4">
              <span className="eyebrow">A better billing rhythm</span>
              <span className="w-2 h-2 rounded-full bg-[#8b9c70]" />
            </div>
            {[
              ['01', 'Build your offer', 'Products & plans'],
              ['02', 'Make it recurring', 'Contracts & renewals'],
              ['03', 'Close the loop', 'Invoices & payments'],
            ].map(([n, t, s]) => (
              <div className="auth-ledger-row" key={n}>
                <span className="text-[10px] text-[#acb49c]">{n}</span>
                <span className="text-[#4f6040] font-medium">{t}</span>
                <span className="text-[9px]">{s}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#8a9677]">
          <ShieldCheck size={13} /> Local-first. Ready for real work.
        </div>
      </aside>
      <main className="auth-form-side">
        <div className="auth-form-inner">
          <div className="mb-10 lg:hidden">
            <Brand />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
