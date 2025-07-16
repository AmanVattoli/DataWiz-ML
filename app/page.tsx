"use client"

import { useRef } from "react"
import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { Dashboard, DashboardRef } from "@/components/dashboard"
import { Footer } from "@/components/footer"
import { DataProvider } from "@/components/data-context"

export default function HomePage() {
  const dashboardRef = useRef<DashboardRef>(null)

  const handleUploadClick = () => {
    dashboardRef.current?.setActiveTab("clean")
    // Scroll to dashboard
    const dashboardElement = document.getElementById("dashboard")
    if (dashboardElement) {
      dashboardElement.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <DataProvider>
      <div className="min-h-screen bg-gray-900">
        <Header />
        <Hero onUploadClick={handleUploadClick} />
        <div id="dashboard">
          <Dashboard ref={dashboardRef} />
        </div>
        <Footer />
      </div>
    </DataProvider>
  )
}
