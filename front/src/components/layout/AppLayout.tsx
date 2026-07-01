import type { ReactNode } from 'react';

type AppLayoutProps = {
  children: ReactNode;
};

function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>Ai job tracker</h1>

        <nav>
          <a href="#">Dashboard</a>
          <a href="#">Jobs</a>
          <a href="#">AI Assistant</a>
          <a href="#">Analytics</a>
          <a href="#">Settings</a>
        </nav>
      </header>
      <main className="app-content">{children}</main>
    </div>
  );
}

export default AppLayout;
