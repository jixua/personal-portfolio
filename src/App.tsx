/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { Projects } from "./components/Projects";
import { Experience } from "./components/Experience";
import { Blog } from "./components/Blog";
import { Footer } from "./components/Footer";
import { SectionDivider } from "./components/SectionDivider";
import { Portfolio } from "./pages/Portfolio";
import { BlogPage } from "./pages/BlogPage";
import { AdminPage } from "./pages/AdminPage";
import { DataProvider } from "./context/DataContext";

function ScrollToHashElement() {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    if (hash) {
      const element = document.getElementById(hash.replace('#', ''));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [hash, pathname]);

  return null;
}

function Home() {
  return (
    <>
      <Hero />
      <SectionDivider />
      <Projects />
      <SectionDivider />
      <Experience />
      <SectionDivider />
      <Blog />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DataProvider>
      <ScrollToHashElement />
      <div className="min-h-screen bg-[#fafafa] relative flex flex-col">
        <div className="absolute inset-0 bg-grid-pattern z-0 opacity-40 pointer-events-none" />
        <Routes>
          <Route path="/" element={<MainLayout><Home /></MainLayout>} />
          <Route path="/portfolio" element={<MainLayout><Portfolio /></MainLayout>} />
          <Route path="/blog" element={<MainLayout><BlogPage /></MainLayout>} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </div>
      </DataProvider>
    </BrowserRouter>
  );
}

function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="relative z-10 w-full overflow-hidden flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
