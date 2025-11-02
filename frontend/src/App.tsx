import { Suspense, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ScrollToTop from './components/ScrollToTop';
import ScrollToTopOnNavigate from './components/ScrollToTopOnNavigate';
import { Menu } from 'lucide-react';

export default function App() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();

    // Don't show sidebar on login/register pages
    const authPages = ['/login', '/register'];
    const isAuthPage = authPages.includes(location.pathname);

    // Show sidebar on all pages except auth pages
    const showSidebar = !isAuthPage;

    return (
        <div className="min-h-screen bg-app">
            {/* Scroll to top on route change */}
            <ScrollToTopOnNavigate />

            <Suspense fallback={
                <div className="flex flex-col items-center justify-center gap-4 min-h-screen">
                    <div
                        className="w-12 h-12 border-4 rounded-full animate-spin"
                        style={{ borderColor: 'var(--cyan)', borderTopColor: 'transparent' }}
                    ></div>
                    <p className="text-accent">Loading...</p>
                </div>
            }>
                {/* Layout with Sidebar for authenticated pages */}
                {showSidebar ? (
                    <div className="flex min-h-screen">
                        {/* Sidebar */}
                        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

                        {/* Overlay for mobile when sidebar is open */}
                        {sidebarOpen && (
                            <div
                                className="md:hidden fixed inset-0 bg-black/50 z-40"
                                onClick={() => setSidebarOpen(false)}
                            />
                        )}

                        {/* Main Content Area */}
                        <div className="flex-1 md:ml-72">
                            {/* Mobile Menu Button */}
                            <div className="md:hidden fixed top-4 left-4 z-30">
                                <button
                                    onClick={() => setSidebarOpen(true)}
                                    className="p-3 bg-card border border-accent rounded-xl shadow-lg text-neon"
                                    aria-label="Open menu"
                                >
                                    <Menu size={24} />
                                </button>
                            </div>

                            {/* Header */}
                            <Header />

                            {/* Page Content */}
                            <main className="px-4 md:px-8 pb-8">
                                <Outlet />
                            </main>
                        </div>
                    </div>
                ) : (
                    // Public pages without sidebar
                    <Outlet />
                )}
            </Suspense>

            {/* Scroll to Top Button */}
            <ScrollToTop />
        </div>
    );
}
